import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Utilities' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'Parent category id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
