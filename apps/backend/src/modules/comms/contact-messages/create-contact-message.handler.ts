import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageDto } from './create-contact-message.dto';
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from './captcha.verifier';

@Injectable()
export class CreateContactMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  async execute(dto: CreateContactMessageDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required');
    }

    const ok = await this.captcha.verify(dto.captchaToken);
    if (!ok) throw new UnauthorizedException('Captcha verification failed');

    return this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
      },
      select: { id: true, createdAt: true, status: true },
    });
  }
}
