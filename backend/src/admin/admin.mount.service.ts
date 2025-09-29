import { Injectable } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
import { PrismaService } from '../prisma/prisma.service';
import type AdminJSType from 'adminjs';

let AdminJS: typeof AdminJSType | undefined;
let AdminJSExpress: unknown;
let AdminJSPrisma: unknown;

@Injectable()
export class AdminMountService {
  constructor(private readonly prisma: PrismaService) {}

  async mount(app: NestExpressApplication) {
    const expressApp = app.getHttpAdapter().getInstance();
    try {
      // Use native dynamic import at runtime (avoid TS transpiling to require in CJS)
      // We deliberately use the Function constructor here to access the native dynamic import
      // at runtime and avoid TypeScript downleveling `import()` to `require()` in CommonJS,
      // which would break ESM-only packages (e.g., adminjs). This is a single, contained use
      // with no user input, so it is safe in this context.
      const importESM = <T = unknown>(m: string): Promise<T> =>
        (new Function('m', 'return import(m)') as (m: string) => Promise<T>)(m);

      // adminjs (ESM default)
      const adminJSImport = await importESM('adminjs');
      const adminJsNs = adminJSImport as Record<string, unknown>;
      const adminResolved =
        'default' in adminJsNs ? adminJsNs.default : adminJSImport;
      AdminJS = adminResolved as typeof AdminJSType;

      // @adminjs/express (ESM default)
      const expressImport = await importESM('@adminjs/express');
      const expressNs = expressImport as Record<string, unknown>;
      AdminJSExpress =
        ('default' in expressNs ? expressNs.default : expressImport) ?? null;

      // @adminjs/prisma (ESM default)
      const prismaImport = await importESM('@adminjs/prisma');
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
      branding: { companyName: 'Cadence Admin' },
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
        ): { email: string } | null =>
          email === ADMIN_EMAIL && password === ADMIN_PASSWORD
            ? { email }
            : null,
        cookieName: 'adminjs',
        cookiePassword:
          process.env.ADMIN_COOKIE_SECRET || 'admin-cookie-secret',
      },
      null,
      { resave: false, saveUninitialized: true },
    );

    // Load infra settings (rate limit and allowlist) from AppSetting, fallback to env
    const infraRow = await this.prisma.getAppSettingDelegate().findUnique({
      where: { key: 'infra' },
    });
    const infra = (infraRow?.value as
      | {
          rateLimit?: { windowMs?: number; adminMax?: number };
          allowlist?: string[];
        }
      | undefined) ?? { rateLimit: {}, allowlist: [] };
    const windowMs = Number(
      infra.rateLimit?.windowMs ??
        process.env.RATE_LIMIT_WINDOW_MS ??
        15 * 60 * 1000,
    );
    const adminMax = Math.min(
      100,
      Number(
        infra.rateLimit?.adminMax ?? process.env.RATE_LIMIT_ADMIN_MAX ?? 50,
      ),
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

    // Optional allowlist for /admin (from DB or env)
    const allowlist =
      (Array.isArray(infra.allowlist) && infra.allowlist.length
        ? infra.allowlist
        : (process.env.ADMIN_ALLOWLIST || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)) ?? [];
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
