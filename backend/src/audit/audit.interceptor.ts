import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

/**
 * AuditInterceptor
 * - Intercepts mutating HTTP methods and captures an audit trail entry
 * - Scrubs sensitive fields (passwords, tokens) from request bodies
 * - Sends the sanitized snapshot to AuditService asynchronously
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    const method = req.method?.toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating) return next.handle();

    const actorId = req.user?.id;
    const path = req.path || '';
    const url = req.originalUrl || req.url || '';
    const action = `${method} ${path || url}`;
    const targetType = path.split('/')[1] || undefined; // crude guess
    const targetId = req.params?.id ? String(req.params.id) : undefined;
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    // Scrub potentially sensitive fields from body using a safe JSON replacer
    const scrub = (obj: unknown): unknown => {
      try {
        const json = JSON.stringify(obj, (k: string, v: unknown) =>
          /password|secret|token|authorization/i.test(k) ? '[REDACTED]' : v,
        );
        return JSON.parse(json) as unknown;
      } catch {
        return undefined;
      }
    };

    const before = undefined; // Could be filled by services for precise diffs
    const afterBody = scrub(req.body);
    return next.handle().pipe(
      tap(() => {
        if (!actorId) return;
        void this.audit
          .log({
            actorId,
            action,
            targetType,
            targetId,
            before,
            after: afterBody,
            ip,
            userAgent,
          })
          .catch(() => {
            // swallow audit logging errors
          });
      }),
    );
  }
}
