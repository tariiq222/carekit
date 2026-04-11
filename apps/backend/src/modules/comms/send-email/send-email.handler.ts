import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { SmtpService } from '../../../infrastructure/mail';
import type { SendEmailDto } from './send-email.dto';

@Injectable()
export class SendEmailHandler {
  private readonly logger = new Logger(SendEmailHandler.name);

  constructor(
    private readonly smtp: SmtpService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: SendEmailDto): Promise<void> {
    if (!this.smtp.isAvailable()) {
      this.logger.warn('SMTP not available — skipping email');
      return;
    }

    const template = await this.prisma.emailTemplate.findUnique({
      where: { tenantId_slug: { tenantId: dto.tenantId, slug: dto.templateSlug } },
    });

    if (!template || !template.isActive) {
      this.logger.warn(`Email template "${dto.templateSlug}" not found for tenant ${dto.tenantId}`);
      return;
    }

    const html = this.interpolate(template.htmlBody, dto.vars);
    const subject = this.interpolate(template.subjectAr, dto.vars);

    try {
      await this.smtp.sendMail(dto.to, subject, html);
    } catch (err) {
      this.logger.error(`Failed to send email to ${dto.to}`, err);
    }
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }
}
