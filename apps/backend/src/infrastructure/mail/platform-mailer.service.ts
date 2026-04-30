import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM = 'Deqah <noreply@webvue.pro>';
const DEFAULT_REPLY_TO = 'support@webvue.pro';

@Injectable()
export class PlatformMailerService implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailerService.name);
  private client: Resend | null = null;
  private from = DEFAULT_FROM;
  private replyTo = DEFAULT_REPLY_TO;

  constructor(private readonly config: ConfigService) {}

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
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendOtpLogin(
    to: string,
    vars: import('./templates/otp-login.template').OtpLoginVars,
  ): Promise<void> {
    const { otpLoginTemplate } = await import('./templates/otp-login.template');
    const t = otpLoginTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendTrialEnding(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    const { trialEndingTemplate } = await import('./templates/trial-ending.template');
    const t = trialEndingTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
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
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendTrialSuspendedNoCard(
    to: string,
    vars: import('./templates/trial-suspended-no-card.template').TrialSuspendedNoCardVars,
  ): Promise<void> {
    const { trialSuspendedNoCardTemplate } = await import('./templates/trial-suspended-no-card.template');
    const t = trialSuspendedNoCardTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendSubscriptionPaymentSucceeded(
    to: string,
    vars: import('./templates/subscription-payment-succeeded.template').SubscriptionPaymentSucceededVars,
  ): Promise<void> {
    const { subscriptionPaymentSucceededTemplate } = await import('./templates/subscription-payment-succeeded.template');
    const t = subscriptionPaymentSucceededTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendSubscriptionPaymentFailed(
    to: string,
    vars: import('./templates/subscription-payment-failed.template').SubscriptionPaymentFailedVars,
  ): Promise<void> {
    const { subscriptionPaymentFailedTemplate } = await import('./templates/subscription-payment-failed.template');
    const t = subscriptionPaymentFailedTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendDunningRetry(
    to: string,
    vars: import('./templates/dunning-retry.template').DunningRetryVars,
  ): Promise<void> {
    const { dunningRetryTemplate } = await import('./templates/dunning-retry.template');
    const t = dunningRetryTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendPlanChanged(
    to: string,
    vars: import('./templates/plan-changed.template').PlanChangedVars,
  ): Promise<void> {
    const { planChangedTemplate } = await import('./templates/plan-changed.template');
    const t = planChangedTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  async sendAccountStatusChanged(
    to: string,
    vars: import('./templates/account-status-changed.template').AccountStatusChangedVars,
  ): Promise<void> {
    const { accountStatusChangedTemplate } = await import('./templates/account-status-changed.template');
    const t = accountStatusChangedTemplate(vars);
    await this.dispatch(to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private bilingualSubject(ar: string, en: string): string {
    return `${ar} · ${en}`;
  }

  private async dispatch(to: string, subject: string, html: string): Promise<void> {
    if (!this.client) {
      this.logger.warn(`PlatformMailer unavailable — skipping email to ${to}`);
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
      }
    } catch (err) {
      this.logger.error(`Resend dispatch threw for ${to}`, err as Error);
    }
  }
}
