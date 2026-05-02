import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { SmtpService } from '../../../infrastructure/mail';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { SendEmailDto } from './send-email.dto';

export type SendEmailCommand = SendEmailDto;

@Injectable()
export class SendEmailHandler {
  private readonly logger = new Logger(SendEmailHandler.name);

  constructor(
    private readonly smtp: SmtpService,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly emailFactory: EmailProviderFactory,
  ) {}

  async execute(dto: SendEmailCommand): Promise<void> {
    // SaaS-02f: slug uniqueness is now composite-per-org. The Prisma Proxy
    // auto-scopes `where` by organizationId from CLS, so findFirst is correct here.
    const template = await this.prisma.emailTemplate.findFirst({
      where: { slug: dto.templateSlug },
    });

    if (!template || !template.isActive) {
      this.logger.warn(`Email template "${dto.templateSlug}" not found`);
      return;
    }

    const html = this.interpolate(template.htmlBody, dto.vars);
    const subject = this.interpolate(template.subject, dto.vars);

    // Try per-tenant email provider first; fall back to platform SMTP.
    try {
      const organizationId = this.tenant.requireOrganizationIdOrDefault();
      const tenantAdapter = await this.emailFactory.forCurrentTenant(organizationId);

      if (tenantAdapter.isAvailable()) {
        await tenantAdapter.sendMail({ to: dto.to, subject, html });
        return;
      }
    } catch {
      // Tenant config lookup failed — fall through to platform SMTP
    }

    // Platform-level SMTP fallback (legacy behavior)
    if (!this.smtp.isAvailable()) {
      this.logger.warn('No email provider configured — skipping send to ' + dto.to);
      return;
    }

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
