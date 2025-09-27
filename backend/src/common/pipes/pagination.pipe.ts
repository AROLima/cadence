import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { PaginationParams } from '../dto/pagination.dto';

interface PaginationPipeOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

@Injectable()
export class PaginationPipe implements PipeTransform {
  constructor(private readonly options: PaginationPipeOptions = {}) {}

  transform(
    value: Record<string, unknown>,
    metadata: ArgumentMetadata,
  ): PaginationParams {
    if (metadata.type !== 'query') {
      throw new BadRequestException(
        'PaginationPipe can only be used on query parameters',
      );
    }

    const rawPage = this.normalizeNumber(value?.page, 1);
    const defaultPageSize = this.options.defaultPageSize ?? 20;
    const maxPageSize = this.options.maxPageSize ?? 100;
    const rawPageSize = this.normalizeNumber(
      value?.pageSize ?? value?.limit,
      defaultPageSize,
    );

    const page = Math.max(rawPage, 1);
    const pageSize = Math.min(Math.max(rawPageSize, 1), maxPageSize);

    return {
      page,
      pageSize,
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  private normalizeNumber(input: unknown, fallback: number): number {
    if (typeof input === 'number' && Number.isFinite(input)) {
      return Math.trunc(input);
    }

    if (typeof input === 'string') {
      const parsed = Number.parseInt(input, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}
