import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntryInput {
  actorId: number;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntryInput) {
    // Avoid storing huge payloads inadvertently
    const truncate = (v: unknown): unknown => {
      try {
        const s = JSON.stringify(v);
        if (s.length > 8000) return { truncated: true };
        return v;
      } catch {
        return undefined;
      }
    };

    return (this.prisma as any)['auditLog'].create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason,
        before: truncate(entry.before),
        after: truncate(entry.after),
        ip: entry.ip,
        userAgent: entry.userAgent,
      },
    });
  }
}
