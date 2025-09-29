import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationPrefsDto {
  @ApiPropertyOptional({ description: 'Email notifications', default: true })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({
    description: 'Push/browser notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class UpdateMySettingsDto {
  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({ example: 'pt-BR' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: ['monday', 'sunday'] })
  @IsOptional()
  @IsIn(['monday', 'sunday'])
  weekStart?: 'monday' | 'sunday';

  @ApiPropertyOptional({ type: NotificationPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;

  @ApiPropertyOptional({
    description: 'Preferred currency (ISO 4217)',
    example: 'BRL',
  })
  @IsOptional()
  @IsString()
  currency?: string; // e.g., 'BRL', 'USD', 'EUR'
}

export type MySettings = Required<{
  theme: 'light' | 'dark' | 'system';
  locale: string;
  timezone: string;
  weekStart: 'monday' | 'sunday';
  notifications: Required<NotificationPrefsDto>;
  currency: string;
}>;

export const DEFAULT_MY_SETTINGS: MySettings = {
  theme: 'system',
  locale: 'en-US',
  timezone: 'UTC',
  weekStart: 'monday',
  notifications: {
    email: true,
    push: false,
  },
  currency: 'USD',
};
