import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import rateLimit from 'express-rate-limit';
import { AdminMountService } from './admin.mount.service';
import { AdminSettingsController } from './admin.settings.controller';
import { AdminInfraController } from './admin.infra.controller';

// Lazy require AdminJS to avoid build-time issues when not installed in prod
import type AdminJSType from 'adminjs';
let AdminJS: typeof AdminJSType | undefined;
let AdminJSExpress: unknown;
let AdminJSPrisma: unknown;

@Module({
  providers: [PrismaService, UsersService, ConfigService, AdminMountService],
  exports: [AdminMountService],
  controllers: [AdminSettingsController, AdminInfraController],
})
export class AdminModule implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // nothing; actual mount happens from main bootstrap via useFactory patterns typically
  }

  async mount(app: NestExpressApplication) {
    const expressApp = app.getHttpAdapter().getInstance();
    try {
      const importDynamic = async <T = unknown>(s: string): Promise<T> =>
        (await import(s)) as T;

      // adminjs (ESM default)
      const adminJSImport = await importDynamic('adminjs');
      const adminJsNs = adminJSImport as Record<string, unknown>;
      const adminResolved =
        'default' in adminJsNs ? adminJsNs.default : adminJSImport;
      AdminJS = adminResolved as typeof AdminJSType;

      // @adminjs/express (ESM default)
      const expressImport = await importDynamic('@adminjs/express');
      const expressNs = expressImport as Record<string, unknown>;
      AdminJSExpress =
        ('default' in expressNs ? expressNs.default : expressImport) ?? null;

      // @adminjs/prisma (ESM default)
      const prismaImport = await importDynamic('@adminjs/prisma');
      const prismaNs = prismaImport as Record<string, unknown>;
      AdminJSPrisma =
        ('default' in prismaNs ? prismaNs.default : prismaImport) ?? null;
    } catch (e) {
      console.warn(
        'AdminJS not installed or failed to load, skipping /admin mount',
      );
      console.warn('Reason:', (e as Error)?.message ?? e);
      // Provide a friendly fallback handler to avoid 404s when UI is disabled
      expressApp.get('/admin', (_req, res) => {
        res.status(503).json({
          success: false,
          message:
            'Admin UI is disabled. Install adminjs, @adminjs/express, @adminjs/prisma and restart the server.',
        });
      });
      return;
    }

    if (!AdminJS || !AdminJSPrisma) {
      expressApp.get('/admin', (_req, res) => {
        res.status(503).json({
          success: false,
          message:
            'Admin UI unavailable: missing AdminJS or Prisma adapter. Ensure adminjs and @adminjs/prisma are installed.',
        });
      });
      return;
    }
    const PrismaAdapter = AdminJSPrisma as {
      Resource: unknown;
      Database: unknown;
    };
    const AdminReg = AdminJS as unknown as {
      registerAdapter: (adapter: unknown) => void;
    };
    AdminReg.registerAdapter(PrismaAdapter);

    const admin = new AdminJS({
      rootPath: '/admin',
      branding: {
        companyName: 'Cadence Admin',
      },
      resources: [
        {
          resource: this.prisma.user,
          options: {
            listProperties: ['id', 'email', 'name', 'role', 'createdAt'],
          },
        },
        { resource: this.prisma.financeAccount },
        { resource: this.prisma.financeCategory },
        { resource: this.prisma.financeTransaction },
        { resource: this.prisma.task },
        { resource: this.prisma.budget },
        // Use bracket access to avoid type errors if Prisma client types are stale
        {
          resource: (this.prisma as unknown as Record<string, unknown>)[
            'auditLog'
          ],
        },
      ],
    });

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@orga.app';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

    if (!AdminJSExpress) {
      expressApp.get('/admin', (_req, res) => {
        res.status(503).json({
          success: false,
          message:
            'Admin UI unavailable: @adminjs/express not loaded. Ensure it is installed.',
        });
      });
      return;
    }
    type AdminJsExpressModule = {
      buildAuthenticatedRouter: (
        admin: InstanceType<typeof AdminJSType>,
        options: {
          authenticate: (
            email: string,
            password: string,
          ) => { email: string } | null;
          cookieName: string;
          cookiePassword: string;
        },
        predefinedRouter?: unknown,
        sessionOptions?: { resave: boolean; saveUninitialized: boolean },
      ) => import('express').Router;
    };
    const { buildAuthenticatedRouter } = AdminJSExpress as AdminJsExpressModule;
    const router = buildAuthenticatedRouter(
      admin,
      {
        authenticate: (
          email: string,
          password: string,
        ): { email: string } | null => {
          if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            return { email };
          }
          return null;
        },
        cookieName: 'adminjs',
        cookiePassword:
          process.env.ADMIN_COOKIE_SECRET || 'admin-cookie-secret',
      },
      null,
      {
        resave: false,
        saveUninitialized: true,
      },
    );

    // Extra rate limiting on /admin
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
    const adminMax = Math.min(
      100,
      Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 50),
    );

    expressApp.use(
      '/admin',
      rateLimit({
        windowMs,
        max: adminMax,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    // Optional allowlist for /admin
    const allowlist = (process.env.ADMIN_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowlist.length) {
      expressApp.use('/admin', (req, res, next) => {
        const ipHeader =
          (req.headers['x-forwarded-for'] as string) || req.ip || '';
        const clientIp = ipHeader.split(',')[0].trim();
        if (!allowlist.includes(clientIp)) {
          return res.status(403).send('Admin access not allowed from this IP');
        }
        next();
      });
    }

    expressApp.use(admin.options.rootPath, router);
    console.log('AdminJS mounted at /admin');
  }
}
