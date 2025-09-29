import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min, IsString, Length } from 'class-validator';

export class UpdateAdminSettingsDto {
  @ApiPropertyOptional({
    description: 'Company display name',
    example: 'Cadence',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Default ISO 4217 currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Fiscal year start month (1..12)',
    minimum: 1,
    maximum: 12,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalMonthStart?: number;
}
