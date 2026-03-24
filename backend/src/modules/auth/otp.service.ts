import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { type OtpType as PrismaOtpType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { SALT_ROUNDS } from '../../config/constants.js';
import { OtpType } from './enums/otp-type.enum.js';
import { UserPayload } from '../../common/types/user-payload.type.js';
import { TokenService } from './token.service.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async generateOtp(userId: string, type: OtpType | string): Promise<string> {
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate existing OTPs of same type
    await this.prisma.otpCode.updateMany({
      where: { userId, type: type as PrismaOtpType, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.otpCode.create({
      data: { userId, code, type: type as PrismaOtpType, expiresAt },
    });

    return code;
  }

  async verifyOtp(email: string, code: string, type: OtpType | string): Promise<UserPayload> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, type: type as PrismaOtpType, code, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      const activeOtp = await this.prisma.otpCode.findFirst({
        where: {
          userId: user.id,
          type: type as PrismaOtpType,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeOtp) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Invalid OTP',
          error: 'AUTH_OTP_INVALID',
        });
      }

      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP has expired',
        error: 'AUTH_OTP_EXPIRED',
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP has expired',
        error: 'AUTH_OTP_EXPIRED',
      });
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    return this.tokenService.buildUserPayloadFromId(user.id);
  }

  async verifyEmail(userId: string, code: string): Promise<void> {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { userId, type: OtpType.VERIFY_EMAIL, code, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP has expired',
        error: 'AUTH_OTP_EXPIRED',
      });
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, type: OtpType.RESET_PASSWORD, code, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP has expired',
        error: 'AUTH_OTP_EXPIRED',
      });
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }

  private generateOtpCode(): string {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }
}
