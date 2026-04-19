import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface ClientTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ClientJwtPayload {
  sub: string;
  email: string;
  namespace: 'client';
  jti: string;
}

@Injectable()
export class ClientTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokenPair(client: {
    id: string;
    email: string | null;
  }): Promise<ClientTokenPair> {
    const jti = randomUUID();
    const payload: ClientJwtPayload = {
      sub: client.id,
      email: client.email ?? '',
      namespace: 'client',
      jti,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_CLIENT_ACCESS_TTL') ?? '7d',
    });

    return { accessToken, refreshToken: jti };
  }

  verifyToken(token: string): ClientJwtPayload | null {
    try {
      return this.jwt.verify<ClientJwtPayload>(token, {
        secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
