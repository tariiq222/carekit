import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { ClientTokenService } from '../shared/client-token.service';
import { DEFAULT_ORGANIZATION_ID, TenantContextService } from '../../../common/tenant';

@Injectable()
export class ClientRefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientTokens: ClientTokenService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: {
        clientId,
        organizationId,
        tokenSelector: selector,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matched: (typeof candidates)[0] | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        matched = c;
        break;
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.clientRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId },
    });
    if (!client || !client.isActive || client.deletedAt) {
      throw new UnauthorizedException('Client not found or inactive');
    }

    const tokens = await this.clientTokens.issueTokenPair(
      { id: clientId, email: client.email },
      { organizationId: matched.organizationId ?? client.organizationId ?? DEFAULT_ORGANIZATION_ID },
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefresh,
    };
  }
}
