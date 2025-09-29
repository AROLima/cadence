import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransactionDto {
  /** Transaction kind (INCOME, EXPENSE, TRANSFER) */
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  /** Source account id */
  @ApiProperty({ example: 1, description: 'Account identifier' })
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  accountId!: number;

  /** Target account for transfers (required when type is TRANSFER) */
  @ApiPropertyOptional({
    example: 2,
    description: 'Target account for transfers',
  })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  targetAccountId?: number;

  /** Optional category id for income/expense */
  @ApiPropertyOptional({ example: 1, description: 'Category identifier' })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  categoryId?: number;

  /** Positive amount; service valida regras específicas para transfer */
  @ApiProperty({ example: 125.75 })
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsNumber()
  amount!: number;

  /** ISO 8601 date-time string (UTC recomendado) */
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  occurredAt!: string;

  /** Observações livres (até 500 chars) */
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Tags normalizadas em lower-case; aceita array ou string separada por vírgulas */
  @ApiPropertyOptional({ type: [String], example: ['groceries', 'family'] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }): string[] | undefined => {
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string' && value.length > 0) {
      return value.split(',').map((tag) => tag.trim());
    }
    return undefined;
  })
  tags?: string[];

  /** URL de anexo (nota fiscal, comprovante) */
  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;

  /** Total de parcelas (para planos parcelados) */
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  installmentsTotal?: number;

  /** Número da parcela atual (geralmente 1 na criação de um plano) */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  installmentNumber?: number;

  /** RRULE (RFC5545) para recorrências, ex: FREQ=MONTHLY;COUNT=6 */
  @ApiPropertyOptional({
    description: 'RFC5545 RRULE for recurring transactions',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  recurrenceRRule?: string;
}
