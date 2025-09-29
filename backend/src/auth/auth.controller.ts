/**
 * AuthController
 * Endpoints for authentication lifecycle:
 * - POST /auth/register → create account, return tokens
 * - POST /auth/login → authenticate and issue tokens
 * - POST /auth/refresh → exchange refresh token for new tokens
 * - POST /auth/logout → revoke refresh tokens for the current user
 * Swagger decorators document inputs/outputs; guards are applied where needed.
 */
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { createApiResponse } from '../common/dto/api-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  // Create a new user account and return access/refresh tokens
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return createApiResponse<AuthResponseDto>(result);
  }

  @Public()
  @Post('login')
  // Authenticate using email/password and return tokens
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return createApiResponse<AuthResponseDto>(result);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  // Use refresh token (guard-validated) to mint new tokens
  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @CurrentUser() user: AuthUser,
    @Req() request: RequestWithUser,
    @Body() body: RefreshTokenDto,
  ) {
    const refreshToken = request.refreshToken ?? body.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.authService.refreshTokens(user, refreshToken);
    return createApiResponse<AuthResponseDto>(result);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  // Revoke active refresh tokens for the authenticated user
  @ApiOperation({ summary: 'Invalidate active refresh tokens' })
  async logout(@CurrentUser('id') userId: number) {
    await this.authService.logout(userId);
    return createApiResponse({ message: 'Logged out successfully' });
  }
}
