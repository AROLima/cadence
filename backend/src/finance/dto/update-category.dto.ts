import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({ description: 'Parent category id', nullable: true })
  @IsOptional()
  @Transform(({ value }): number | null | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === 'null' || value === '') {
      return null;
    }
    return Number(value);
  })
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
