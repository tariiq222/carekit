import { ConfigService } from '@nestjs/config';
import { PlatformMailerService } from './platform-mailer.service';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

function configWith(env: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) =>
      (env[key] as unknown as T) ?? fallback,
  } as ConfigService;
}

describe('PlatformMailerService — bootstrap', () => {
  beforeEach(() => {
    mockSend.mockReset();
    delete process.env.NODE_ENV;
  });

  it('isAvailable() = false in dev when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'development';
    const svc = new PlatformMailerService(configWith({}));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(false);
  });

  it('isAvailable() = true when RESEND_API_KEY is present', () => {
    const svc = new PlatformMailerService(configWith({ RESEND_API_KEY: 're_test' }));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(true);
  });

  it('throws on bootstrap in production when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    const svc = new PlatformMailerService(configWith({}));
    expect(() => svc.onModuleInit()).toThrow(/RESEND_API_KEY/);
  });
});

describe('PlatformMailerService — send', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.NODE_ENV = 'development';
  });

  function build(): PlatformMailerService {
    const svc = new PlatformMailerService(
      configWith({
        RESEND_API_KEY: 're_test',
        RESEND_FROM: 'CareKit <noreply@webvue.pro>',
        RESEND_REPLY_TO: 'support@webvue.pro',
      }),
    );
    svc.onModuleInit();
    return svc;
  }

  it('sendTenantWelcome calls Resend with from/replyTo/subject/html', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const svc = build();

    await svc.sendTenantWelcome('owner@example.com', {
      ownerName: 'Tariq',
      orgName: 'Sawa',
      dashboardUrl: 'https://app.example/dashboard',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.from).toBe('CareKit <noreply@webvue.pro>');
    expect(arg.replyTo).toBe('support@webvue.pro');
    expect(arg.to).toEqual(['owner@example.com']);
    expect(arg.subject).toContain('CareKit');
    expect(arg.html).toContain('Tariq');
    expect(arg.html).toContain('Sawa');
  });

  it('returns void and does NOT throw when Resend errors', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: '5xx upstream' } });
    const svc = build();
    await expect(
      svc.sendTenantWelcome('owner@example.com', {
        ownerName: 'X',
        orgName: 'Y',
        dashboardUrl: 'https://x',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns void and warns when client is unavailable', async () => {
    delete process.env.NODE_ENV;
    const svc = new PlatformMailerService(configWith({}));
    svc.onModuleInit();
    await expect(
      svc.sendOtpLogin('user@example.com', { code: '123456', expiresInMinutes: 10 }),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendOtpLogin uses the OTP subject + interpolates the code', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_2' }, error: null });
    const svc = build();
    await svc.sendOtpLogin('user@example.com', { code: '482913', expiresInMinutes: 5 });
    const arg = mockSend.mock.calls[0][0];
    expect(arg.html).toContain('482913');
    expect(arg.subject.toLowerCase()).toMatch(/code|رمز/);
  });

  it('trial, payment, plan, and account-status methods all dispatch via Resend', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg' }, error: null });
    const svc = build();

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

    expect(mockSend).toHaveBeenCalledTimes(10);
  });
});
