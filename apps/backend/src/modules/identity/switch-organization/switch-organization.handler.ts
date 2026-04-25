import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService, TokenPair } from '../shared/token.service';
import type { SwitchOrganizationCommand } from './switch-organization.command';

/**
 * SaaS-06 — Switch the caller's active organization context.
 *
 * Verifies the user has an ACTIVE membership in the target organization,
 * then issues a fresh JWT + refresh token pair whose claims point at the
 * new `organizationId` + `membershipId`. The previous tokens remain valid
 * until their natural expiry; the frontend replaces them client-side.
 */
@Injectable()
export class SwitchOrganizationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: SwitchOrganizationCommand): Promise<TokenPair> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: cmd.userId,
          organizationId: cmd.targetOrganizationId,
        },
      },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'User has no membership in the target organization',
      );
    }
    if (!membership.isActive) {
      throw new ForbiddenException(
        'Membership in the target organization is not active',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      include: { customRole: { include: { permissions: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId: cmd.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.tokens.issueTokenPair(user, {
      organizationId: membership.organizationId,
      membershipId: membership.id,
      isSuperAdmin: user.role === 'SUPER_ADMIN',
    });
  }
}
