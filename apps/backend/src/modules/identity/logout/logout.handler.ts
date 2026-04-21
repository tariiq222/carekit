import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import type { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    // Scope revocation by current org so a super-admin impersonating a user
    // in org A cannot accidentally kill that user's sessions in org B.
    await this.prisma.refreshToken.updateMany({
      where: { userId: cmd.userId, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
