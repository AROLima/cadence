import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Review quarterly budget' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    example: 'Ensure all expense reports are collected',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'RFC5545 RRULE definition for repeating tasks',
  })
  @IsOptional()
  @IsString()
  repeatRRule?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['finance', 'reporting'] })
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
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Parent task identifier or null to detach',
    nullable: true,
  })
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
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
