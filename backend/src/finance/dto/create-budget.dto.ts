import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(3000)
  year!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 1500.0 })
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsNumber()
  @Min(0)
  plannedAmount!: number;
}
