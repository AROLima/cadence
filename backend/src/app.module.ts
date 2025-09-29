/**
 * AppModule
 * - Central wiring of all feature modules (Auth, Users, Me, Tasks, Finance, Reports, Admin)
 * - Applies two global interceptors via APP_INTERCEPTOR provider token:
 *   - ApiResponseInterceptor: normalizes successful responses into a consistent envelope
 *   - AuditInterceptor: records write operations into AuditLog for traceability
 */
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { AuthModule } from './auth/auth.module';
import { FinanceModule } from './finance/finance.module';
import { MeModule } from './me/me.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AdminModule } from './admin/admin.module';
import { AdminController } from './admin/admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuditModule,
    AdminModule,
    AuthModule,
    UsersModule,
    MeModule,
    TasksModule,
    FinanceModule,
    ReportsModule,
  ],
  controllers: [AppController, AdminController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
