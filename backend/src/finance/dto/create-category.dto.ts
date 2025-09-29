import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  /** Category name */
  @ApiProperty({ example: 'Utilities' })
  @IsString()
  @MinLength(2)
  name!: string;

  /** Optional parent id to build a tree; null clears parent */
  @ApiPropertyOptional({ description: 'Parent category id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
