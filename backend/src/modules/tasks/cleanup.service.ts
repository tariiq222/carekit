import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async cleanExpiredRefreshTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired refresh tokens`);
    }
  }
}
