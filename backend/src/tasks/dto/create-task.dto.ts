import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';

export class CreateTaskDto {
  /** Short task title */
  @ApiProperty({ example: 'Review quarterly budget' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  /** Optional long description */
  @ApiPropertyOptional({
    example: 'Ensure all expense reports are collected',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** Initial status (defaults to TODO) */
  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus = TaskStatus.TODO;

  /** Initial priority (defaults to MEDIUM) */
  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  /** Optional due date ISO (UTC recomendado) */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Recurrence rule (RFC5545), e.g., FREQ=WEEKLY;COUNT=4 */
  @ApiPropertyOptional({
    description: 'RFC5545 RRULE definition for repeating tasks',
  })
  @IsOptional()
  @IsString()
  repeatRRule?: string;

  /** Optional tags: array ou string separada por vírgulas */
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

  /** Parent task id (for subtasks) */
  @ApiPropertyOptional({ description: 'Parent task identifier for subtasks' })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number;
}
