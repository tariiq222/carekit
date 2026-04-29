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
