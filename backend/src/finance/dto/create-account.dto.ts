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
  @ApiProperty({ example: 'Main Checking' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'checking', description: 'Account type label' })
  @IsString()
  @MinLength(2)
  type!: string;

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
