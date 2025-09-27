import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { dump } from 'js-yaml';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/common/swagger/swagger.config';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig(), {
    deepScanRoutes: true,
  });

  const yaml = dump(document, { lineWidth: -1 });
  const outputPath = join(process.cwd(), 'openapi.yaml');
  writeFileSync(outputPath, yaml, { encoding: 'utf-8' });

  await app.close();
}

void generateOpenApi().catch((error) => {
  console.error('[openapi:generate] Failed to generate spec:', error);
  process.exit(1);
});
