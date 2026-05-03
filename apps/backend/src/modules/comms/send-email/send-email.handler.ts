import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { SmtpService } from '../../../infrastructure/mail';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { UsageCounterService } from '../../platform/billing/usage-counter/usage-counter.service';
import { SubscriptionCacheService } from '../../platform/billing/subscription-cache.service';
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
    private readonly usageCounter: UsageCounterService,
    private readonly subscriptionCache: SubscriptionCacheService,
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
    let useFallback = true;
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

    if (useFallback) {
      await this.sendViaFallback(dto.to, subject, html);
    }
  }

  private async sendViaFallback(to: string, subject: string, html: string): Promise<void> {
    // Platform-level SMTP fallback — enforce monthly email quota
    if (!this.smtp.isAvailable()) {
      this.logger.warn('No email provider configured — skipping send to ' + to);
      return;
    }

    // Quota enforcement for platform fallback sends
    const orgId = this.safeGetOrgId();
    if (orgId) {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const cached = await this.subscriptionCache.get(orgId).catch(() => null);
      const limit = cached ? (cached.limits['email_fallback_monthly'] as number | undefined) ?? -1 : -1;

      if (limit !== -1) {
        const current = (await this.usageCounter.read(orgId, FeatureKey.EMAIL_FALLBACK_MONTHLY, periodStart)) ?? 0;
        if (current >= limit) {
          throw new ForbiddenException({
            code: 'PLAN_LIMIT_REACHED',
            limitKind: 'email_fallback_monthly',
            current,
            limit,
          });
        }
        await this.usageCounter.increment(orgId, FeatureKey.EMAIL_FALLBACK_MONTHLY, periodStart);
      }
    }

    try {
      await this.smtp.sendMail(to, subject, html);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }

  private safeGetOrgId(): string | null {
    try {
      return this.tenant.requireOrganizationIdOrDefault();
    } catch {
      return null;
    }
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }
}
