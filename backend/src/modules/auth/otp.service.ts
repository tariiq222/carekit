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
import { AuthCacheService } from './auth-cache.service.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly authCache: AuthCacheService,
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

    // Atomic OTP claim: updateMany atomically marks the OTP as used and returns
    // count > 0 only if the record existed AND was not yet used AND not expired.
    // This prevents two concurrent requests from both verifying the same OTP code.
    const now = new Date();
    const claimed = await this.prisma.otpCode.updateMany({
      where: {
        userId: user.id,
        type: type as PrismaOtpType,
        code,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (claimed.count === 0) {
      // Distinguish expired vs wrong code for better UX
      const activeOtp = await this.prisma.otpCode.findFirst({
        where: {
          userId: user.id,
          type: type as PrismaOtpType,
          usedAt: null,
          expiresAt: { gt: now },
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
        message: 'OTP has expired or was already used',
        error: 'AUTH_OTP_EXPIRED',
      });
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    return this.tokenService.buildUserPayloadFromId(user.id);
  }

  async verifyEmail(userId: string, code: string): Promise<void> {
    const now = new Date();
    const claimed = await this.prisma.otpCode.updateMany({
      where: { userId, type: OtpType.VERIFY_EMAIL as PrismaOtpType, code, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (claimed.count === 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid or expired OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    // Invalidate cached user payload so next /me call reflects emailVerified=true
    await this.authCache.invalidate(userId);
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

    const now = new Date();
    const claimed = await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: OtpType.RESET_PASSWORD as PrismaOtpType, code, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (claimed.count === 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid or expired OTP',
        error: 'AUTH_OTP_INVALID',
      });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, isActive: true },
    });

    // Invalidate all sessions: revoke refresh tokens + clear auth cache
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await this.authCache.invalidate(user.id);
  }

  private generateOtpCode(): string {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }
}
