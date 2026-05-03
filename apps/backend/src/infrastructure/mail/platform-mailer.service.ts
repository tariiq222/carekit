import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../database/prisma.service';

const DEFAULT_FROM = 'Deqah <noreply@webvue.pro>';
const DEFAULT_REPLY_TO = 'support@webvue.pro';

type PlatformEmailLogClient = {
  platformEmailLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<void>;
  };
};

@Injectable()
export class PlatformMailerService implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailerService.name);
  private client: Resend | null = null;
  private from = DEFAULT_FROM;
  private replyTo = DEFAULT_REPLY_TO;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma: PrismaService | null = null,
  ) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('RESEND_FROM') ?? DEFAULT_FROM;
    this.replyTo = this.config.get<string>('RESEND_REPLY_TO') ?? DEFAULT_REPLY_TO;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is required in production');
      }
      this.logger.warn(
        'RESEND_API_KEY not set — platform mail disabled (dev/test mode).',
      );
      return;
    }

    this.client = new Resend(apiKey);
    this.logger.log('PlatformMailerService initialized');
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  // ── Public send API ────────────────────────────────────────────────────────

  async sendTenantWelcome(
    to: string,
    vars: import('./templates/tenant-welcome.template').TenantWelcomeVars,
  ): Promise<void> {
    const { tenantWelcomeTemplate } = await import('./templates/tenant-welcome.template');
    const t = tenantWelcomeTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'tenant-welcome' });
  }

  async sendOtpLogin(
    to: string,
    vars: import('./templates/otp-login.template').OtpLoginVars,
  ): Promise<void> {
    const { otpLoginTemplate } = await import('./templates/otp-login.template');
    const t = otpLoginTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'otp-login' });
  }

  async sendTrialEnding(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    const { trialEndingTemplate } = await import('./templates/trial-ending.template');
    const t = trialEndingTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'trial-ending' });
  }

  async sendTrialDay7Reminder(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    await this.sendTrialEnding(to, vars);
  }

  async sendTrialDay3Warning(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    await this.sendTrialEnding(to, vars);
  }

  async sendTrialDay1Final(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    await this.sendTrialEnding(to, vars);
  }

  async sendTrialExpired(
    to: string,
    vars: import('./templates/trial-expired.template').TrialExpiredVars,
  ): Promise<void> {
    const { trialExpiredTemplate } = await import('./templates/trial-expired.template');
    const t = trialExpiredTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'trial-expired' });
  }

  async sendTrialSuspendedNoCard(
    to: string,
    vars: import('./templates/trial-suspended-no-card.template').TrialSuspendedNoCardVars,
  ): Promise<void> {
    const { trialSuspendedNoCardTemplate } = await import('./templates/trial-suspended-no-card.template');
    const t = trialSuspendedNoCardTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'trial-suspended-no-card' });
  }

  async sendSubscriptionPaymentSucceeded(
    to: string,
    vars: import('./templates/subscription-payment-succeeded.template').SubscriptionPaymentSucceededVars,
  ): Promise<void> {
    const { subscriptionPaymentSucceededTemplate } = await import('./templates/subscription-payment-succeeded.template');
    const t = subscriptionPaymentSucceededTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'subscription-payment-succeeded' });
  }

  async sendSubscriptionPaymentFailed(
    to: string,
    vars: import('./templates/subscription-payment-failed.template').SubscriptionPaymentFailedVars,
  ): Promise<void> {
    const { subscriptionPaymentFailedTemplate } = await import('./templates/subscription-payment-failed.template');
    const t = subscriptionPaymentFailedTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'subscription-payment-failed' });
  }

  async sendDunningRetry(
    to: string,
    vars: import('./templates/dunning-retry.template').DunningRetryVars,
  ): Promise<void> {
    const { dunningRetryTemplate } = await import('./templates/dunning-retry.template');
    const t = dunningRetryTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'dunning-retry' });
  }

  async sendPlanChanged(
    to: string,
    vars: import('./templates/plan-changed.template').PlanChangedVars,
  ): Promise<void> {
    const { planChangedTemplate } = await import('./templates/plan-changed.template');
    const t = planChangedTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'plan-changed' });
  }

  async sendAccountStatusChanged(
    to: string,
    vars: import('./templates/account-status-changed.template').AccountStatusChangedVars,
  ): Promise<void> {
    const { accountStatusChangedTemplate } = await import('./templates/account-status-changed.template');
    const t = accountStatusChangedTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'account-status-changed' });
  }

  async sendMembershipInvitation(
    to: string,
    vars: import('./templates/membership-invitation.template').MembershipInvitationVars,
  ): Promise<void> {
    const { membershipInvitationTemplate } = await import('./templates/membership-invitation.template');
    const t = membershipInvitationTemplate(vars);
    await this.dispatch({ to, subject: this.bilingualSubject(t.subjectAr, t.subjectEn), html: t.html, templateSlug: 'membership-invitation' });
  }

  /**
   * Send a raw email with full control over to/subject/html.
   * Used by the platform email test-send endpoint.
   */
  async sendRaw(opts: { to: string; subject: string; html: string; templateSlug: string }): Promise<void> {
    await this.dispatch(opts);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private bilingualSubject(ar: string, en: string): string {
    return `${ar} · ${en}`;
  }

  private async dispatch(opts: {
    to: string;
    subject: string;
    html: string;
    templateSlug: string;
    organizationId?: string;
  }): Promise<void> {
    const { to, subject, html, templateSlug, organizationId } = opts;

    // Write QUEUED log row if prisma is available
    let logId: string | undefined;
    if (this.prisma) {
      try {
        const logClient = this.prisma as unknown as PlatformEmailLogClient;
        const row = await logClient.platformEmailLog.create({
          data: {
            templateSlug,
            toAddress: to,
            status: 'QUEUED',
            ...(organizationId ? { organizationId } : {}),
          },
        });
        logId = row.id;
      } catch (err) {
        this.logger.warn(`Failed to write PlatformEmailLog QUEUED row: ${String(err)}`);
      }
    }

    if (!this.client) {
      this.logger.warn(`PlatformMailer unavailable — skipping email to ${to}`);
      if (logId && this.prisma) {
        await this.updateLog(logId, 'SKIPPED_NOT_CONFIGURED', undefined, 'No Resend client configured').catch(() => {/* ignore */});
      }
      return;
    }

    try {
      const res = await this.client.emails.send({
        from: this.from,
        replyTo: this.replyTo,
        to: [to],
        subject,
        html,
      });
      if (res.error) {
        this.logger.error(`Resend send error for ${to}: ${res.error.message}`);
        if (logId) {
          await this.updateLog(logId, 'FAILED', undefined, res.error.message).catch(() => {/* ignore */});
        }
      } else {
        if (logId) {
          await this.updateLog(logId, 'SENT', res.data?.id, undefined).catch(() => {/* ignore */});
        }
      }
    } catch (err) {
      this.logger.error(`Resend dispatch threw for ${to}`, err as Error);
      if (logId) {
        await this.updateLog(logId, 'FAILED', undefined, String(err)).catch(() => {/* ignore */});
      }
    }
  }

  private async updateLog(
    id: string,
    status: 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED',
    providerMessageId: string | undefined,
    errorMessage: string | undefined,
  ): Promise<void> {
    if (!this.prisma) return;
    const logClient = this.prisma as unknown as PlatformEmailLogClient;
    await logClient.platformEmailLog.update({
      where: { id },
      data: {
        status,
        ...(providerMessageId ? { providerMessageId } : {}),
        ...(errorMessage ? { errorMessage } : {}),
        ...(status === 'SENT' ? { sentAt: new Date() } : {}),
      },
    });
  }
}
