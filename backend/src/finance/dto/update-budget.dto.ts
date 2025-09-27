import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CreateBudgetDto } from './create-budget.dto';

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {
  @ApiPropertyOptional({ example: 1600 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsNumber()
  @Min(0)
  plannedAmount?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Min(1)
  @Max(12)
  month?: number;
}
