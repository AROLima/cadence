import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token if not provided via Authorization header',
    minLength: 20,
  })
  @IsString()
  @MinLength(20)
  @IsOptional()
  refreshToken?: string;
}
