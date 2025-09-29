import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from './common/swagger/swagger.config';
import { AppModule } from './app.module';
import { AdminMountService } from './admin/admin.mount.service';
import { PrismaService } from './prisma/prisma.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  // In production require explicit JWT secrets via environment variables.
  if (isProd) {
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      // Fail fast to avoid insecure defaults
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production.',
      );
    }
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Security middleware: Helmet for common headers hardening
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // Rate limiting: global and stricter on auth routes to mitigate brute force
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000); // 15m
  const max = Number(process.env.RATE_LIMIT_MAX ?? 300);
  const authMax = Number(process.env.RATE_LIMIT_AUTH_MAX ?? 100);

  app.use(
    rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    '/auth',
    rateLimit({
      windowMs,
      max: authMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many auth attempts from this IP, please try again later.',
    }),
  );

  // If behind a proxy (e.g., in production), optionally trust it for correct IPs
  if (process.env.TRUST_PROXY) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', Number(process.env.TRUST_PROXY));
  }

  // CORS: use ALLOWED_ORIGINS (comma-separated) in prod; allow common dev ports otherwise
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  const allowedOrigins = isProd && envOrigins.length ? envOrigins : devOrigins;

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ): void => {
      if (!requestOrigin) {
        // SSR and tools without an Origin header
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: false, // no cross-site cookies used by API
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Disposition'],
  });

  // Swagger: enabled by default in dev; gate via SWAGGER_ENABLED in prod
  const swaggerEnabled = process.env.SWAGGER_ENABLED
    ? process.env.SWAGGER_ENABLED === 'true'
    : !isProd;
  if (swaggerEnabled) {
    const config = buildSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    });

    const docsPath = process.env.SWAGGER_PATH || 'docs';
    SwaggerModule.setup(docsPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    });
  }

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  // Ensure we bind to a known host/port and log it for diagnostics
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  await app.listen(PORT, HOST);
  console.log(`\nAPI listening on http://${HOST}:${PORT}`);

  // Try to mount AdminJS at /admin if dependencies are installed
  try {
    const service = app.get(AdminMountService, { strict: false });
    if (service?.mount) {
      await service.mount(app);
    }
  } catch {
    // Admin service not available; ignore
  }
}

void bootstrap();
