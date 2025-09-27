import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto, AuthenticatedUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.get<string>(
      'JWT_ACCESS_SECRET',
      'access-secret',
    );
    this.refreshSecret = configService.get<string>(
      'JWT_REFRESH_SECRET',
      'refresh-secret',
    );
    this.accessExpiresIn = Number(
      configService.get<number>(
        'JWT_ACCESS_EXPIRES_IN',
        ACCESS_TOKEN_TTL_SECONDS,
      ),
    );
    this.refreshExpiresIn = Number(
      configService.get<number>(
        'JWT_REFRESH_EXPIRES_IN',
        REFRESH_TOKEN_TTL_SECONDS,
      ),
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const resolvedName = dto.name?.trim()?.length
      ? dto.name.trim()
      : (dto.email.split('@')[0] ?? dto.email);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: resolvedName,
          role: Role.USER,
        },
      });

      const tokens = await this.generateTokenPair(user);
      return this.buildAuthResponse(user, tokens);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.revokeActiveRefreshTokens(user.id);
    const tokens = await this.generateTokenPair(user);

    return this.buildAuthResponse(user, tokens);
  }

  async refreshTokens(
    user: AuthUser,
    refreshToken: string,
  ): Promise<AuthResponseDto> {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeTokens.length) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    let matchedTokenId: number | null = null;

    for (const tokenRecord of activeTokens) {
      const isValid = await bcrypt.compare(refreshToken, tokenRecord.token);
      if (isValid) {
        matchedTokenId = tokenRecord.id;
        break;
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedTokenId },
      data: { revokedAt: new Date() },
    });

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!dbUser) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.generateTokenPair(dbUser);

    return this.buildAuthResponse(dbUser, tokens);
  }

  async logout(userId: number): Promise<void> {
    await this.revokeActiveRefreshTokens(userId);
  }

  private async validateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken } satisfies TokenPair;
  }

  private async storeRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = await bcrypt.hash(refreshToken, 12);
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
      },
    });
  }

  private buildAuthResponse(user: User, tokens: TokenPair): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.mapUser(user),
    } satisfies AuthResponseDto;
  }

  private mapUser(user: User): AuthenticatedUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    } satisfies AuthenticatedUserDto;
  }

  private async revokeActiveRefreshTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
    }

    throw error;
  }
}
