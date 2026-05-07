import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';

@Injectable()
export class RefreshTokenCleanupCron {
  private readonly logger = new Logger(RefreshTokenCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
      const result = await this.prisma.$allTenants.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: cutoff } },
            { revokedAt: { not: null, lte: cutoff } },
          ],
        },
      });
      this.logger.log(`deleted ${result.count} stale tokens`);

      const deletedResetTokens = await this.prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: cutoff } },
            { consumedAt: { not: null } },
          ],
        },
      });
      this.logger.log(`Cleaned up ${deletedResetTokens.count} expired/consumed PasswordResetTokens`);
    });
  }
}
