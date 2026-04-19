import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { ResetPasswordDto } from './reset-password.dto';

@Injectable()
export class ResetPasswordHandler {
  private readonly logger = new Logger(ResetPasswordHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpSession: OtpSessionService,
    private readonly passwords: PasswordService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const session = this.otpSession.verifySession(dto.sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (session.purpose !== OtpPurpose.CLIENT_PASSWORD_RESET) {
      throw new UnauthorizedException('Invalid session purpose');
    }

    const now = new Date();
    const expiresAt = session.exp
      ? new Date(session.exp * 1000)
      : new Date(now.getTime() + 30 * 60 * 1000);

    const passwordHash = await this.passwords.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      const identifier = session.identifier;
      const isEmail = session.channel === OtpChannel.EMAIL;

      const client = isEmail
        ? await tx.client.findFirst({ where: { email: identifier, deletedAt: null } })
        : await tx.client.findFirst({ where: { phone: identifier, deletedAt: null } });

      if (!client) {
        throw new UnauthorizedException('Invalid session');
      }

      // Burn OTP session — unique constraint on jti prevents replay
      try {
        await tx.usedOtpSession.create({
          data: { jti: session.jti, consumedAt: now, expiresAt },
        });
      } catch {
        throw new UnauthorizedException('Session already used');
      }

      // Update password
      await tx.client.update({
        where: { id: client.id },
        data: { passwordHash, loginAttempts: 0, lockoutUntil: null },
      });

      // Revoke all existing refresh tokens for this client
      await tx.clientRefreshToken.updateMany({
        where: { clientId: client.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    this.logger.log(`Password reset completed for session identifier: ${session.identifier}`);
  }
}
