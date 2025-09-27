import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto, createApiResponse } from '../dto/api-response.dto';

function isApiResponseDto(value: unknown): value is ApiResponseDto<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiResponseDto<unknown>>;
  return 'success' in candidate && 'data' in candidate;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (isApiResponseDto(payload)) {
          return payload;
        }

        if (payload && typeof payload === 'object') {
          const candidate = payload as Record<string, unknown>;
          if (
            'data' in candidate &&
            ('meta' in candidate || 'pagination' in candidate)
          ) {
            const { data, meta, pagination } = candidate;
            return createApiResponse(
              data,
              (meta ?? pagination) as Record<string, unknown> | undefined,
            );
          }
        }

        return createApiResponse(payload);
      }),
    );
  }
}
