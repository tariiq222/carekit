import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from '../../comms/contact-messages/captcha.verifier';
import { RequestOtpDto } from './request-otp.dto';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MIN = 100_000;
const OTP_MAX = 1_000_000; // exclusive upper bound for randomInt → yields 6 digits
const MAX_REQUESTS_PER_IDENTIFIER_PER_HOUR = 5;

export type RequestOtpCommand = RequestOtpDto;

@Injectable()
export class RequestOtpHandler {
  private readonly logger = new Logger(RequestOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelRegistry: NotificationChannelRegistry,
    @Inject(CAPTCHA_VERIFIER) private readonly captchaVerifier: CaptchaVerifier,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
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

    const orgId = dto.organizationId ?? null;

    return this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);

      // Fix C — per-identifier rate limit: max 5 requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await this.prisma.otpCode.count({
        where: {
          organizationId: orgId,
          identifier: dto.identifier,
          purpose: dto.purpose,
          createdAt: { gt: oneHourAgo },
        },
      });
      if (recentCount >= MAX_REQUESTS_PER_IDENTIFIER_PER_HOUR) {
        throw new HttpException('Too many OTP requests for this identifier', HttpStatus.TOO_MANY_REQUESTS);
      }

      // Use crypto.randomInt (CSPRNG) — OTP codes must not be predictable.
      // randomInt(min, max) returns an int in [min, max); with [100000, 1000000)
      // every result is exactly 6 digits, so no zero-padding is needed.
      const rawCode = randomInt(OTP_MIN, OTP_MAX).toString();
      const codeHash = await bcrypt.hash(rawCode, 10);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const created = await this.prisma.$transaction(async (tx) => {
        await tx.otpCode.updateMany({
          where: {
            organizationId: orgId,
            identifier: dto.identifier,
            purpose: dto.purpose,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        });

        return tx.otpCode.create({
          data: {
            organizationId: orgId,
            channel: dto.channel,
            identifier: dto.identifier,
            codeHash,
            purpose: dto.purpose,
            expiresAt,
          },
          select: { id: true },
        });
      });

      try {
        const channel = this.channelRegistry.resolve(dto.channel);
        // Pass organizationId so the channel can use the tenant's configured
        // provider (e.g. Resend) before falling back to platform transport.
        await channel.send(dto.identifier, rawCode, orgId ?? undefined);
      } catch (err) {
        // Surface send failures: roll back the persisted OTP row so the user
        // can retry without burning their per-hour quota, then bubble up a
        // 503 so the mobile client shows a real error instead of a silent
        // "OTP sent" toast.
        this.logger.error(
          `Failed to send OTP via ${dto.channel} to ${dto.identifier}`,
          err,
        );
        try {
          await this.prisma.otpCode.delete({ where: { id: created.id } });
        } catch (cleanupErr) {
          this.logger.error(
            `Failed to clean up OTP row ${created.id} after send failure`,
            cleanupErr,
          );
        }
        throw new ServiceUnavailableException('Failed to send OTP. Please try again.');
      }

      return { success: true };
    });
  }
}
