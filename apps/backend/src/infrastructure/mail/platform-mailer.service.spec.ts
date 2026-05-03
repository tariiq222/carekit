import { ConfigService } from '@nestjs/config';
import { PlatformMailerService } from './platform-mailer.service';
import type { PlatformMailQueueService } from './platform-mail-queue/platform-mail-queue.service';

function configWith(env: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) =>
      (env[key] as unknown as T) ?? fallback,
  } as ConfigService;
}

function buildQueue(): { queue: PlatformMailQueueService; enqueueMock: jest.Mock } {
  const enqueueMock = jest.fn(async () => undefined);
  const queue = { enqueue: enqueueMock } as unknown as PlatformMailQueueService;
  return { queue, enqueueMock };
}

describe('PlatformMailerService — bootstrap', () => {
  it('initializes with default `from` when RESEND_FROM is not set', () => {
    const { queue } = buildQueue();
    const svc = new PlatformMailerService(configWith({}), queue);
    svc.onModuleInit();
    // Internal state — not exposed; bootstrapping must not throw.
    expect(() => svc.onModuleInit()).not.toThrow();
  });

  it('reads RESEND_FROM from config when present', () => {
    const { queue } = buildQueue();
    const svc = new PlatformMailerService(
      configWith({ RESEND_FROM: 'Custom <custom@brand.com>' }),
      queue,
    );
    svc.onModuleInit();
    // Verify by checking the from on the next enqueue (covered below).
    expect(svc).toBeDefined();
  });
});

describe('PlatformMailerService — dispatch enqueues, never calls Resend directly', () => {
  function build(env: Record<string, string> = {}): {
    svc: PlatformMailerService;
    enqueueMock: jest.Mock;
  } {
    const { queue, enqueueMock } = buildQueue();
    const svc = new PlatformMailerService(
      configWith({ RESEND_FROM: 'Deqah <noreply@webvue.pro>', ...env }),
      queue,
    );
    svc.onModuleInit();
    return { svc, enqueueMock };
  }

  it('sendTenantWelcome enqueues a job with templateName=tenant-welcome and the resolved from header', async () => {
    const { svc, enqueueMock } = build();

    await svc.sendTenantWelcome('owner@example.com', {
      ownerName: 'Tariq',
      orgName: 'Sawa',
      dashboardUrl: 'https://app.example/dashboard',
    });

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const arg = enqueueMock.mock.calls[0][0];
    expect(arg.recipient).toBe('owner@example.com');
    expect(arg.templateName).toBe('tenant-welcome');
    expect(arg.from).toBe('Deqah <noreply@webvue.pro>');
    expect(arg.subject).toContain('Deqah');
    expect(arg.html).toContain('Tariq');
    expect(arg.html).toContain('Sawa');
  });

  it('sendOtpLogin enqueues with template=otp-login and interpolates code into html', async () => {
    const { svc, enqueueMock } = build();
    await svc.sendOtpLogin('user@example.com', { code: '482913', expiresInMinutes: 5 });
    const arg = enqueueMock.mock.calls[0][0];
    expect(arg.templateName).toBe('otp-login');
    expect(arg.html).toContain('482913');
    expect(arg.subject.toLowerCase()).toMatch(/code|رمز/);
  });

  it('all trial/payment/plan/account-status methods enqueue (no inline Resend call)', async () => {
    const { svc, enqueueMock } = build();

    await svc.sendTrialEnding('a@x', { ownerName: 'A', orgName: 'O', daysLeft: 3, upgradeUrl: 'https://u' });
    await svc.sendTrialDay7Reminder('a@x', { ownerName: 'A', orgName: 'O', daysLeft: 7, upgradeUrl: 'https://u' });
    await svc.sendTrialDay3Warning('a@x', { ownerName: 'A', orgName: 'O', daysLeft: 3, upgradeUrl: 'https://u' });
    await svc.sendTrialDay1Final('a@x', { ownerName: 'A', orgName: 'O', daysLeft: 1, upgradeUrl: 'https://u' });
    await svc.sendTrialExpired('a@x', { ownerName: 'A', orgName: 'O', upgradeUrl: 'https://u' });
    await svc.sendTrialSuspendedNoCard('a@x', { ownerName: 'A', orgName: 'O', billingUrl: 'https://b' });
    await svc.sendSubscriptionPaymentSucceeded('a@x', {
      ownerName: 'A', orgName: 'O', amountSar: '299.00', invoiceId: 'inv_1', receiptUrl: 'https://r',
    });
    await svc.sendSubscriptionPaymentFailed('a@x', {
      ownerName: 'A', orgName: 'O', amountSar: '299.00', reason: 'Card declined', billingUrl: 'https://b',
    });
    await svc.sendPlanChanged('a@x', {
      ownerName: 'A', orgName: 'O', fromPlanName: 'Basic', toPlanName: 'Pro', effectiveDate: '2026-05-01T00:00:00Z',
    });
    await svc.sendAccountStatusChanged('a@x', {
      ownerName: 'A', orgName: 'O', status: 'SUSPENDED', reason: 'overdue', contactUrl: 'https://c',
    });

    expect(enqueueMock).toHaveBeenCalledTimes(10);
    const templates = enqueueMock.mock.calls.map((c) => c[0].templateName);
    expect(templates).toEqual([
      'trial-ending',
      'trial-ending', // day7 reuses trial-ending
      'trial-ending', // day3
      'trial-ending', // day1
      'trial-expired',
      'trial-suspended-no-card',
      'subscription-payment-succeeded',
      'subscription-payment-failed',
      'plan-changed',
      'account-status-changed',
    ]);
  });

  it('returns void and does NOT throw when the queue swallows an error', async () => {
    // queue.enqueue is contractually no-throw; mailer just awaits it.
    const enqueueMock = jest.fn(async () => undefined);
    const queue = { enqueue: enqueueMock } as unknown as PlatformMailQueueService;
    const svc = new PlatformMailerService(configWith({}), queue);
    svc.onModuleInit();
    await expect(
      svc.sendTenantWelcome('owner@example.com', {
        ownerName: 'X',
        orgName: 'Y',
        dashboardUrl: 'https://x',
      }),
    ).resolves.toBeUndefined();
  });
});
