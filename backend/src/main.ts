import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from './common/swagger/swagger.config';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    // Allow common local dev origins (localhost and 127.0.0.1) on Vite ports
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ): void => {
      // SSR and tools without an Origin header should be allowed
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
      ];

      const devRegex = /^http:\/\/(localhost|127\.0\.0\.1):517[3-4]$/;

      if (allowed.includes(requestOrigin) || devRegex.test(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Disposition'],
  });

  const config = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  // Ensure we bind to a known host/port and log it for diagnostics
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  await app.listen(PORT, HOST);
  console.log(`\nAPI listening on http://${HOST}:${PORT}`);
}

void bootstrap();
