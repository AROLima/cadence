import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Optional refresh token when not provided via Authorization: Bearer <token> header.
   * Clients may pass it in the body or via header; guard will read from both places.
   */
  @ApiPropertyOptional({
    description: 'Refresh token if not provided via Authorization header',
    minLength: 20,
  })
  @IsString()
  @MinLength(20)
  @IsOptional()
  refreshToken?: string;
}
