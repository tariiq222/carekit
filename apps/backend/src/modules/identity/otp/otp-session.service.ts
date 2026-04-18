import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface OtpSessionPayload {
  identifier: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  jti: string;
  exp?: number;
}

@Injectable()
export class OtpSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signSession(payload: Omit<OtpSessionPayload, 'jti' | 'exp'>): Promise<string> {
    return this.jwt.sign(
      { ...payload, jti: uuidv4() },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: '30m',
      },
    );
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
