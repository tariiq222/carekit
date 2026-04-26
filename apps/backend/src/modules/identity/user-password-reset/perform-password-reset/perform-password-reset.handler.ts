import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database';
import { PasswordService } from '../../shared/password.service';
import { PerformPasswordResetDto } from './perform-password-reset.dto';

@Injectable()
export class PerformPasswordResetHandler {
  private readonly logger = new Logger(PerformPasswordResetHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async execute(dto: PerformPasswordResetDto): Promise<void> {
    const tokenSelector = dto.token.slice(0, 8);
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenSelector, tokenHash },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (record.consumedAt) {
      throw new UnauthorizedException('Token already used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    this.logger.log(`Password reset completed for user ${record.userId}`);
  }
}
