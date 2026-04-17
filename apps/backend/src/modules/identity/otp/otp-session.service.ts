import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';

export interface OtpSessionPayload {
  identifier: string;
  purpose: OtpPurpose;
}

@Injectable()
export class OtpSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signSession(payload: OtpSessionPayload): Promise<string> {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '30m',
    });
  }

  verifySession(token: string): OtpSessionPayload | null {
    try {
      return this.jwt.verify<OtpSessionPayload>(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
