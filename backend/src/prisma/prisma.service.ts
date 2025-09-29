/**
 * PrismaService
 * - Extends PrismaClient to integrate with Nest lifecycle
 * - Provides clean connect/disconnect hooks and a graceful shutdown helper
 */
import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Narrowly typed accessor for AppSetting delegate to keep eslint type rules happy
  getAppSettingDelegate() {
    const delegate = (this as unknown as Record<string, unknown>)[
      'appSetting'
    ] as {
      findUnique: (args: {
        where: { key: string };
      }) => Promise<{ value: unknown } | null>;
      upsert: (args: {
        where: { key: string };
        update: { value: object };
        create: { key: string; value: object };
      }) => Promise<unknown>;
    };
    return delegate;
  }
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    // Close Nest app and DB client gracefully on termination signals
    const shutdown = async (signal: string) => {
      console.log(`\nShutting down gracefully on ${signal}...`);
      try {
        await app.close();
      } finally {
        await this.$disconnect();
      }
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  }
}
