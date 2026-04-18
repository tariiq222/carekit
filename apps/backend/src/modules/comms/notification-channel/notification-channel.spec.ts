import { Test, TestingModule } from '@nestjs/testing';
import { SmtpService } from '../../../infrastructure/mail';
import { EmailChannelAdapter } from './email-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';
import { OtpChannel } from '@prisma/client';

describe('EmailChannelAdapter', () => {
  let adapter: EmailChannelAdapter;
  let smtp: jest.Mocked<SmtpService>;

  beforeEach(async () => {
    const smtpMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: SmtpService, useValue: smtpMock },
      ],
    }).compile();

    adapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
    smtp = module.get(SmtpService);
  });

  it('should have EMAIL kind', () => {
    expect(adapter.kind).toBe(OtpChannel.EMAIL);
  });

  it('should send email via smtp', async () => {
    await adapter.send('test@example.com', '123456');
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'test@example.com',
      'رمز التحقق / Verification Code',
      expect.stringContaining('123456'),
    );
  });

  it('should not throw when smtp is unavailable', async () => {
    smtp.isAvailable.mockReturnValue(false);
    await expect(adapter.send('test@example.com', '123456')).resolves.not.toThrow();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});

describe('NotificationChannelRegistry', () => {
  let registry: NotificationChannelRegistry;
  let emailAdapter: EmailChannelAdapter;

  beforeEach(async () => {
    const smtpMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        NotificationChannelRegistry,
        { provide: SmtpService, useValue: smtpMock },
      ],
    }).compile();

    registry = module.get<NotificationChannelRegistry>(NotificationChannelRegistry);
    emailAdapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
  });

  it('should resolve EMAIL channel', () => {
    const channel = registry.resolve(OtpChannel.EMAIL);
    expect(channel).toBe(emailAdapter);
  });

  it('should throw for unknown channel kind', () => {
    expect(() => registry.resolve('SMS' as OtpChannel)).toThrow('No notification channel registered for kind: SMS');
  });
});
