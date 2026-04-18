import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { VerifyOtpDto } from './verify-otp.dto';
import { OtpSessionService } from './otp-session.service';

const MAX_VERIFY_ATTEMPTS = 5;

export type VerifyOtpCommand = VerifyOtpDto;

@Injectable()
export class VerifyOtpHandler {
  private readonly logger = new Logger(VerifyOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpSession: OtpSessionService,
  ) {}

  async execute(dto: VerifyOtpCommand): Promise<{ sessionToken: string }> {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        identifier: dto.identifier,
        purpose: dto.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const codeMatch = await bcrypt.compare(dto.code, otpRecord.codeHash);
    if (!codeMatch) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    });

    if (otpRecord.channel === 'EMAIL') {
      await this.prisma.client.updateMany({
        where: { email: dto.identifier },
        data: { emailVerified: new Date() },
      });
    } else if (otpRecord.channel === 'SMS') {
      await this.prisma.client.updateMany({
        where: { phone: dto.identifier },
        data: { phoneVerified: new Date() },
      });
    }

    const sessionToken = await this.otpSession.signSession({
      identifier: dto.identifier,
      purpose: dto.purpose,
      channel: otpRecord.channel,
    });

    return { sessionToken };
  }
}
