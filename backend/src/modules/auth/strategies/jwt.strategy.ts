import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenService } from '../token.service.js';
import type { JwtPayload } from '../types/jwt-payload.type.js';
import type { UserPayload } from '../../../common/types/user-payload.type.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      // M4: Explicitly pin to HS256 to prevent algorithm-switching attacks
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<UserPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token',
        error: 'AUTH_TOKEN_INVALID',
      });
    }

    try {
      return await this.tokenService.buildUserPayloadFromId(payload.sub);
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token',
        error: 'AUTH_TOKEN_INVALID',
      });
    }
  }
}
