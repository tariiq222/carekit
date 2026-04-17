import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from '../../comms/contact-messages/captcha.verifier';
import { RequestOtpDto } from './request-otp.dto';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_CODE = 999999;

export type RequestOtpCommand = RequestOtpDto;

@Injectable()
export class RequestOtpHandler {
  private readonly logger = new Logger(RequestOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelRegistry: NotificationChannelRegistry,
    @Inject(CAPTCHA_VERIFIER) private readonly captchaVerifier: CaptchaVerifier,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: RequestOtpCommand): Promise<{ success: boolean }> {
    const captchaValid = await this.captchaVerifier.verify(dto.hCaptchaToken);
    if (!captchaValid) {
      throw new BadRequestException('Invalid captcha token');
    }

    if (dto.channel === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.identifier)) {
        throw new BadRequestException('Invalid email address');
      }
    }

    const rawCode = Math.floor(Math.random() * MAX_OTP_CODE).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({
        where: {
          identifier: dto.identifier,
          purpose: dto.purpose,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });

      await tx.otpCode.create({
        data: {
          channel: dto.channel,
          identifier: dto.identifier,
          codeHash,
          purpose: dto.purpose,
          expiresAt,
        },
      });
    });

    try {
      const channel = this.channelRegistry.resolve(dto.channel);
      await channel.send(dto.identifier, rawCode);
    } catch (err) {
      this.logger.error(`Failed to send OTP via ${dto.channel} to ${dto.identifier}`, err);
    }

    return { success: true };
  }
}
