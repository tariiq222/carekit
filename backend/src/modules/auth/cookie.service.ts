import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      domain: this.configService.get('COOKIE_DOMAIN') || undefined,
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      domain: this.configService.get('COOKIE_DOMAIN') || undefined,
    });
  }

  extractRefreshToken(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE_NAME] || undefined;
  }
}
