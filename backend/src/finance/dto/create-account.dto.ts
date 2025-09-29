import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAccountDto {
  /** Human-friendly account name */
  @ApiProperty({ example: 'Main Checking' })
  @IsString()
  @MinLength(2)
  name!: string;

  /** Free-form type label to group or filter accounts */
  @ApiProperty({ example: 'checking', description: 'Account type label' })
  @IsString()
  @MinLength(2)
  type!: string;

  /** Optional opening balance; coerced to number by Transform */
  @ApiPropertyOptional({ example: 1000.5 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}
