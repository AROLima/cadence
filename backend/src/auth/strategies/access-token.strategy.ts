import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  JwtFromRequestFunction,
  Strategy,
  StrategyOptions,
} from 'passport-jwt';
import { Request } from 'express';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const bearerTokenExtractor: JwtFromRequestFunction = (
  req: Request | undefined,
) => {
  if (!req) {
    return null;
  }
  const authHeader = req.get('authorization');
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) {
    return null;
  }
  return scheme.toLowerCase() === 'bearer' ? token : null;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_ACCESS_SECRET') ?? 'access-secret';

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const options: StrategyOptions = {
      jwtFromRequest: bearerTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(options);
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
