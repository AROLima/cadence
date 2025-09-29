import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class TaskQueryDto {
  /** Filter by multiple statuses */
  @ApiPropertyOptional({ enum: TaskStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @Transform(({ value }): TaskStatus[] | undefined => {
    if (Array.isArray(value)) {
      return value as TaskStatus[];
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value as TaskStatus];
    }
    return undefined;
  })
  status?: TaskStatus[];

  /** Filter by multiple priorities */
  @ApiPropertyOptional({ enum: TaskPriority, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskPriority, { each: true })
  @Transform(({ value }): TaskPriority[] | undefined => {
    if (Array.isArray(value)) {
      return value as TaskPriority[];
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value as TaskPriority];
    }
    return undefined;
  })
  priority?: TaskPriority[];

  /** Due date range start */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  /** Due date range end */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  /** Single tag filter */
  @ApiPropertyOptional({ description: 'Filter by a single tag name' })
  @IsOptional()
  @IsString()
  tag?: string;

  /** Multiple tags filter */
  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by one or more tag names',
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }): string[] | undefined => {
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    return undefined;
  })
  tags?: string[];

  /** Full text search on title/description */
  @ApiPropertyOptional({
    description: 'Full text search on title or description',
  })
  @IsOptional()
  @IsString()
  q?: string;

  /** Include subtasks in root listing */
  @ApiPropertyOptional({
    description: 'Include subtasks in top-level listing',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): boolean | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return undefined;
  })
  includeSubtasks?: boolean;
}
