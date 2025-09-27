import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  JwtFromRequestFunction,
  Strategy,
  StrategyOptionsWithRequest,
} from 'passport-jwt';
import { Request } from 'express';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type RefreshRequest = Request<
  Record<string, unknown>,
  unknown,
  { refreshToken?: string }
>;

function extractRefreshToken(req?: RefreshRequest): string | null {
  if (!req) {
    return null;
  }

  const candidate = req.body?.refreshToken;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }

  const headerToken = req.get('x-refresh-token');
  if (headerToken) {
    return headerToken;
  }

  const authHeader = req.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme && token && scheme.toLowerCase() === 'bearer') {
      return token;
    }
  }

  return null;
}

const refreshTokenExtractor: JwtFromRequestFunction = (request) =>
  extractRefreshToken(request as RefreshRequest);

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_REFRESH_SECRET') ?? 'refresh-secret';

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: refreshTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(options);
  }

  validate(req: RequestWithUser, payload: JwtPayload): AuthUser {
    const refreshToken = extractRefreshToken(req as RefreshRequest);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    req.refreshToken = refreshToken;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
