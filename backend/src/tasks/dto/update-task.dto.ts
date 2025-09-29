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
  /** Optional new title */
  @ApiPropertyOptional({ example: 'Review quarterly budget' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  /** Optional new description */
  @ApiPropertyOptional({
    example: 'Ensure all expense reports are collected',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  /** Update status */
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** Update priority */
  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Update due date or set null to clear */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  /** Update RRULE or set null to clear */
  @ApiPropertyOptional({
    description: 'RFC5545 RRULE definition for repeating tasks',
  })
  @IsOptional()
  @IsString()
  repeatRRule?: string | null;

  /** Replace tags with the provided list */
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

  /** Change parent (number), detach (null) ou manter (undefined) */
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
