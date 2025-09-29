import { ApiPropertyOptional } from '@nestjs/swagger';

import { TransactionType } from '@prisma/client';

import { Expose, Transform } from 'class-transformer';

import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TransactionQueryDto {
  @ApiPropertyOptional({ enum: TransactionType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TransactionType, { each: true })
  @Transform(({ value }): TransactionType[] | undefined => {
    if (Array.isArray(value)) {
      return value as TransactionType[];
    }

    if (typeof value === 'string' && value.length > 0) {
      return [value as TransactionType];
    }

    return undefined;
  })
  type?: TransactionType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsInt()
  @Min(1)
  accountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    name: 'dateFrom',

    format: 'date-time',

    description: 'ISO date-time; accepts dateFrom or from query param',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value, obj }): string | undefined => {
    const o = obj as unknown as Record<string, unknown> | undefined;
    const candidate: unknown = value ?? o?.dateFrom ?? o?.from;
    const rawValue = typeof candidate === 'string' ? candidate : undefined;

    if (typeof rawValue !== 'string') {
      return undefined;
    }

    const trimmed = rawValue.trim();

    return trimmed.length ? trimmed : undefined;
  })
  from?: string;

  @ApiPropertyOptional({
    name: 'dateTo',

    format: 'date-time',

    description: 'ISO date-time; accepts dateTo or to query param',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value, obj }): string | undefined => {
    const o = obj as unknown as Record<string, unknown> | undefined;
    const candidate: unknown = value ?? o?.dateTo ?? o?.to;
    const rawValue = typeof candidate === 'string' ? candidate : undefined;

    if (typeof rawValue !== 'string') {
      return undefined;
    }

    const trimmed = rawValue.trim();

    return trimmed.length ? trimmed : undefined;
  })
  to?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }): string[] | undefined => {
    if (Array.isArray(value)) {
      return value as string[];
    }

    if (typeof value === 'string' && value.length > 0) {
      return value

        .split(',')

        .map((tag) => tag.trim())

        .filter(Boolean);
    }

    return undefined;
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Full text search by notes, attachments, or related names',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  })
  q?: string;

  @Expose({ name: 'dateFrom' })
  private set mapDateFrom(value: string | undefined) {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    this.from = trimmed.length ? trimmed : undefined;
  }

  @Expose({ name: 'dateTo' })
  private set mapDateTo(value: string | undefined) {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    this.to = trimmed.length ? trimmed : undefined;
  }
}
