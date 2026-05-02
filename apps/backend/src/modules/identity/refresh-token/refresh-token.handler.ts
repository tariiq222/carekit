import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';
import { TokenService, TokenPair } from '../shared/token.service';
import type { RefreshTokenCommand } from './refresh-token.command';

@Injectable()
export class RefreshTokenHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: RefreshTokenCommand): Promise<TokenPair> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: cmd.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: (typeof candidates)[0] | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(cmd.rawToken, c.tokenHash)) { matched = c; break; }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.refreshToken.update({ where: { id: matched.id }, data: { revokedAt: new Date() } });

    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    // Carry the tenant through the refresh cycle. DEFAULT_ORGANIZATION_ID is
    // the safety net for tokens issued before the SaaS-02a backfill — should
    // be zero in prod once the backfill migration runs.
    return this.tokens.issueTokenPair(user, {
      organizationId: matched.organizationId ?? DEFAULT_ORGANIZATION_ID,
      isSuperAdmin: user.isSuperAdmin ?? false,
    });
  }
}
