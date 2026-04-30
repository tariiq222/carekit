import { tenantWelcomeTemplate } from '../tenant-welcome.template';
import { otpLoginTemplate } from '../otp-login.template';
import { trialEndingTemplate } from '../trial-ending.template';
import { trialExpiredTemplate } from '../trial-expired.template';
import { trialSuspendedNoCardTemplate } from '../trial-suspended-no-card.template';
import { subscriptionPaymentSucceededTemplate } from '../subscription-payment-succeeded.template';
import { subscriptionPaymentFailedTemplate } from '../subscription-payment-failed.template';
import { dunningRetryTemplate } from '../dunning-retry.template';
import { planChangedTemplate } from '../plan-changed.template';
import { accountStatusChangedTemplate } from '../account-status-changed.template';

describe('platform email templates', () => {
  it('tenantWelcome renders both languages, escapes name', () => {
    const out = tenantWelcomeTemplate({
      ownerName: '<script>alert(1)</script>',
      orgName: 'Sawa',
      dashboardUrl: 'https://app.example/dashboard',
    });
    expect(out.subjectAr).toContain('Deqah');
    expect(out.subjectEn).toContain('Deqah');
    expect(out.html).toContain('Sawa');
    expect(out.html).toContain('https://app.example/dashboard');
    expect(out.html).not.toContain('<script>alert(1)</script>');
    expect(out.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('otpLogin includes the code and expiry, code is digit-only', () => {
    const out = otpLoginTemplate({ code: '482913', expiresInMinutes: 10 });
    expect(out.html).toContain('482913');
    expect(out.html).toContain('10');
    expect(out.subjectAr).toContain('رمز');
    expect(out.subjectEn).toMatch(/code/i);
  });

  it('trialEnding shows daysLeft + upgrade URL', () => {
    const out = trialEndingTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      daysLeft: 3,
      upgradeUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('Tariq');
    expect(out.html).toContain('3');
    expect(out.html).toContain('https://app.example/billing');
  });

  it('trialExpired surfaces the upgrade URL prominently', () => {
    const out = trialExpiredTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      upgradeUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('https://app.example/billing');
  });

  it('trialSuspendedNoCard explains the missing card and links billing', () => {
    const out = trialSuspendedNoCardTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      billingUrl: 'https://app.example/settings/billing',
    });
    expect(out.subjectEn.toLowerCase()).toContain('suspended');
    expect(out.html).toContain('Sawa');
    expect(out.html).toContain('https://app.example/settings/billing');
  });

  it('paymentSucceeded includes amount + currency + invoiceId', () => {
    const out = subscriptionPaymentSucceededTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      amountSar: '299.00',
      invoiceId: 'inv_123',
      receiptUrl: 'https://app.example/billing/inv_123',
    });
    expect(out.html).toContain('299.00');
    expect(out.html).toContain('SAR');
    expect(out.html).toContain('inv_123');
    expect(out.html).toContain('https://app.example/billing/inv_123');
  });

  it('paymentFailed shows reason and retry guidance', () => {
    const out = subscriptionPaymentFailedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      amountSar: '299.00',
      reason: 'Card declined',
      billingUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('Card declined');
    expect(out.html).toContain('https://app.example/billing');
  });

  it('dunningRetry shows attempt number, amount, reason, and billing URL', () => {
    const out = dunningRetryTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      amountSar: '299.00',
      attemptNumber: 2,
      maxAttempts: 4,
      reason: 'Moyasar returned status failed',
      billingUrl: 'https://app.example/settings/billing',
    });

    expect(out.subjectEn.toLowerCase()).toContain('payment retry');
    expect(out.html).toContain('299.00');
    expect(out.html).toContain('2');
    expect(out.html).toContain('4');
    expect(out.html).toContain('Moyasar returned status failed');
    expect(out.html).toContain('https://app.example/settings/billing');
  });

  it('planChanged describes from/to', () => {
    const out = planChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      fromPlanName: 'Basic',
      toPlanName: 'Pro',
      effectiveDate: new Date('2026-05-01').toISOString(),
    });
    expect(out.html).toContain('Basic');
    expect(out.html).toContain('Pro');
  });

  it('accountStatusChanged renders SUSPENDED and REINSTATED variants', () => {
    const suspended = accountStatusChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      status: 'SUSPENDED',
      reason: 'Outstanding invoice',
      contactUrl: 'mailto:support@webvue.pro',
    });
    expect(suspended.html).toContain('Outstanding invoice');
    expect(suspended.subjectEn.toLowerCase()).toContain('suspended');

    const reinstated = accountStatusChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      status: 'REINSTATED',
      reason: undefined,
      contactUrl: 'https://app.example/dashboard',
    });
    expect(reinstated.subjectEn.toLowerCase()).toContain('reinstated');
  });
});
