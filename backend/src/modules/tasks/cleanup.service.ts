import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run every day at 3:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanExpiredOtps() {
    const result = await this.prisma.otpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired/used OTP codes`);
    }
  }

  // Run every day at 3:30 AM
  @Cron('0 30 3 * * *')
  async cleanExpiredRefreshTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired refresh tokens`);
    }
  }
}
