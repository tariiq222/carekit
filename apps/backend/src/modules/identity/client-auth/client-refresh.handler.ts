import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ClientRefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: {
        clientId,
        tokenSelector: selector,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matched: (typeof candidates)[0] | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) { matched = c; break; }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.clientRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.isActive || client.deletedAt) {
      throw new UnauthorizedException('Client not found or inactive');
    }

    const jti = randomUUID();
    const payload = {
      sub: clientId,
      email: client.email ?? '',
      namespace: 'client' as const,
      jti,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_CLIENT_ACCESS_TTL') ?? '7d',
    });

    const rawRefresh = randomUUID();
    const tokenSelector = rawRefresh.slice(0, 8);
    const tokenHash = await bcrypt.hash(rawRefresh, 10);
    const ttl = this.config.get<string>('JWT_CLIENT_ACCESS_TTL') ?? '7d';
    const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl));

    await this.prisma.clientRefreshToken.create({
      data: { clientId, tokenHash, tokenSelector, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * multipliers[match[2]];
  }
}
