import { ConfigService } from '@nestjs/config';
import { ResendSenderService } from './resend-sender.service';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

function configWith(env: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) => (env[key] as unknown as T) ?? fallback,
  } as ConfigService;
}

describe('ResendSenderService — bootstrap', () => {
  beforeEach(() => {
    mockSend.mockReset();
    delete process.env.NODE_ENV;
  });

  it('isAvailable() = false in dev when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'development';
    const svc = new ResendSenderService(configWith({}));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(false);
  });

  it('throws on bootstrap in production when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    const svc = new ResendSenderService(configWith({}));
    expect(() => svc.onModuleInit()).toThrow(/RESEND_API_KEY/);
  });

  it('initializes when RESEND_API_KEY is present', () => {
    const svc = new ResendSenderService(configWith({ RESEND_API_KEY: 're_test' }));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(true);
  });
});

describe('ResendSenderService.send', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.NODE_ENV = 'development';
  });

  function build(env: Record<string, string> = { RESEND_API_KEY: 're_test' }): ResendSenderService {
    const svc = new ResendSenderService(configWith(env));
    svc.onModuleInit();
    return svc;
  }

  it('happy path: forwards from/replyTo/subject/html and returns Resend message id', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const svc = build({ RESEND_API_KEY: 're_test', RESEND_REPLY_TO: 'support@webvue.pro' });

    const out = await svc.send({
      to: 'owner@example.com',
      from: 'Deqah <noreply@webvue.pro>',
      subject: 'Hello',
      html: '<p>hi</p>',
    });

    expect(out).toEqual({ id: 'msg_1' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Deqah <noreply@webvue.pro>',
      replyTo: 'support@webvue.pro',
      to: ['owner@example.com'],
      subject: 'Hello',
      html: '<p>hi</p>',
    });
  });

  it('throws when Resend returns an error envelope (so BullMQ retries)', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: '5xx upstream' } });
    const svc = build();

    await expect(
      svc.send({
        to: 'owner@example.com',
        from: 'Deqah <noreply@webvue.pro>',
        subject: 'Hello',
        html: '<p>hi</p>',
      }),
    ).rejects.toThrow(/5xx upstream/);
  });

  it('throws when called without an initialized client (dev mode, no key)', async () => {
    const svc = new ResendSenderService(configWith({}));
    svc.onModuleInit();
    await expect(
      svc.send({
        to: 'owner@example.com',
        from: 'Deqah <noreply@webvue.pro>',
        subject: 'Hello',
        html: '<p>hi</p>',
      }),
    ).rejects.toThrow(/RESEND_API_KEY missing/);
  });

  it('propagates network errors thrown by the SDK', async () => {
    mockSend.mockRejectedValue(new Error('ETIMEDOUT'));
    const svc = build();
    await expect(
      svc.send({
        to: 'owner@example.com',
        from: 'Deqah <noreply@webvue.pro>',
        subject: 'Hello',
        html: '<p>hi</p>',
      }),
    ).rejects.toThrow('ETIMEDOUT');
  });
});
