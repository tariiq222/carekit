import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SmtpService } from './smtp.service';

jest.mock('nodemailer');

const mockedNodemailer = jest.mocked(nodemailer);

describe('SmtpService', () => {
  let service: SmtpService;
  let mockSendMail: jest.Mock;

  function buildModule(smtpHost: string | undefined): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        SmtpService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string | number | undefined> = {
                SMTP_HOST: smtpHost,
                SMTP_PORT: 587,
                SMTP_USER: 'user@test.com',
                SMTP_PASS: 'secret',
                SMTP_FROM: 'noreply@test.com',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();
  }

  afterEach(() => jest.clearAllMocks());

  describe('when SMTP_HOST is absent', () => {
    beforeEach(async () => {
      const mod = await buildModule(undefined);
      service = mod.get(SmtpService);
      service.onModuleInit();
    });

    it('isAvailable returns false', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('sendMail throws', async () => {
      await expect(service.sendMail('a@b.com', 'subj', '<p>hi</p>')).rejects.toThrow('SMTP is not initialized');
    });
  });

  describe('when SMTP_HOST is present', () => {
    beforeEach(async () => {
      mockSendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-msg-1' });
      mockedNodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);

      const mod = await buildModule('smtp.example.com');
      service = mod.get(SmtpService);
      service.onModuleInit();
    });

    it('isAvailable returns true', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('sendMail calls transporter.sendMail with correct args', async () => {
      await service.sendMail('dest@clinic.com', 'Test Subject', '<p>Hello</p>');
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: 'dest@clinic.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });
    });

    it('sendMail uses custom from when provided', async () => {
      await service.sendMail('dest@clinic.com', 'Hi', '<p>Hi</p>', 'custom@clinic.com');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@clinic.com' }));
    });

    it('sendBulk sends all emails', async () => {
      await service.sendBulk([
        { to: 'a@clinic.com', subject: 'S1', html: '<p>1</p>' },
        { to: 'b@clinic.com', subject: 'S2', html: '<p>2</p>' },
      ]);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });
});
