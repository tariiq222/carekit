import { MailerService } from '@nestjs-modules/mailer';
import { EmailProcessor } from '../../../src/modules/email/email.processor.js';
import { EmailTemplatesService } from '../../../src/modules/email-templates/email-templates.service.js';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { QueueFailureService } from '../../../src/common/queue/queue-failure.service.js';
import type { Job } from 'bullmq';

const mockMailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
const mockQueueFailureService = { notifyAdminsOfFailure: jest.fn().mockResolvedValue(undefined) };
const mockEmailTemplatesService = { renderTemplate: jest.fn() };
const mockWhitelabelService = {
  getConfigMap: jest.fn().mockResolvedValue({
    system_name: 'Test Clinic',
    system_name_ar: 'عيادة تجريبية',
    logo: '',
    primary_color: '#2563EB',
    email_header_show_logo: 'true',
    email_header_show_name: 'true',
    email_footer_phone: '',
    email_footer_website: '',
    email_footer_instagram: '',
    email_footer_twitter: '',
    email_footer_snapchat: '',
    email_footer_tiktok: '',
    email_footer_linkedin: '',
    email_footer_youtube: '',
  }),
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'send-email',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      template: 'otp-login',
      to: 'test@example.com',
      subject: 'Test Subject',
      context: { code: '123456' },
    },
    ...overrides,
  } as unknown as Job;
}

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Instantiate directly to avoid NestJS DI complexity with WorkerHost
    processor = new EmailProcessor(
      mockMailerService as unknown as MailerService,
      mockQueueFailureService as unknown as QueueFailureService,
      mockEmailTemplatesService as unknown as EmailTemplatesService,
      mockWhitelabelService as unknown as WhitelabelService,
    );

    // Bypass WorkerHost.worker (not available in unit tests)
    Object.defineProperty(processor, 'worker', {
      get: () => ({ on: jest.fn() }),
      configurable: true,
    });
  });

  describe('process()', () => {
    it('sends email using DB template when both languages render successfully', async () => {
      mockEmailTemplatesService.renderTemplate
        .mockResolvedValueOnce({ subject: 'EN Subject', body: 'EN Body' })
        .mockResolvedValueOnce({ subject: 'AR Subject', body: 'AR Body' });

      await processor.process(makeJob());

      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'EN Subject | AR Subject',
        }),
      );
      const call = mockMailerService.sendMail.mock.calls[0][0];
      expect(call.text).toContain('EN Body');
      expect(call.text).toContain('AR Body');
      expect(call.html).toBeDefined();
      expect(call.html).toContain('EN Body');
      expect(call.html).toContain('AR Body');
    });

    it('falls back to buildPlainText when DB template returns null', async () => {
      mockEmailTemplatesService.renderTemplate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await processor.process(makeJob());

      // Should still call sendMail — with plain text fallback
      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const call = mockMailerService.sendMail.mock.calls[0][0];
      expect(call.subject).toBe('Test Subject'); // original subject preserved
    });

    it('falls back to buildPlainText when DB template throws', async () => {
      mockEmailTemplatesService.renderTemplate.mockRejectedValue(new Error('DB error'));

      await processor.process(makeJob());

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
    });

    it('skips sending for unknown job names', async () => {
      const job = makeJob({ name: 'unknown-job' } as Partial<Job>);
      await processor.process(job);
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('calls renderTemplate for both en and ar', async () => {
      mockEmailTemplatesService.renderTemplate.mockResolvedValue(null);

      await processor.process(makeJob());

      expect(mockEmailTemplatesService.renderTemplate).toHaveBeenCalledTimes(2);
      expect(mockEmailTemplatesService.renderTemplate).toHaveBeenCalledWith(
        'otp-login',
        { code: '123456' },
        'en',
      );
      expect(mockEmailTemplatesService.renderTemplate).toHaveBeenCalledWith(
        'otp-login',
        { code: '123456' },
        'ar',
      );
    });
  });
});
