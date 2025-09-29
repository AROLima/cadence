import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class BudgetQueryDto {
  /** Year filter (YYYY) */
  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(3000)
  year?: number;

  /** Month filter (1-12) */
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
