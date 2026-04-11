import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { buildPlainText } from './email.helpers.js';
import { buildHtmlEmail, type EmailLayoutConfig } from './email.layout.js';
import { EmailTemplatesService } from '../email-templates/email-templates.service.js';
import { WhitelabelService } from '../whitelabel/whitelabel.service.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';
import { QueueFailureService } from '../../common/queue/queue-failure.service.js';
import { JOB_ATTEMPTS, QUEUE_EMAIL } from '../../config/constants/queues.js';

interface SendEmailJobData {
  template: string;
  to: string;
  subject: string;
  context: Record<string, unknown>;
}

@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly queueFailureService: QueueFailureService,
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly whitelabelService: WhitelabelService,
    private readonly clinicSettingsService: ClinicSettingsService,
  ) {
    super();
  }

  onModuleInit() {
    this.worker.on('failed', async (job, error) => {
      const isFinal =
        (job && job.attemptsMade >= (job.opts.attempts ?? JOB_ATTEMPTS)) ||
        error.name === 'UnrecoverableError';
      if (isFinal) {
        await this.queueFailureService.notifyAdminsOfFailure(
          QUEUE_EMAIL,
          job?.name ?? 'unknown',
          job?.id,
          job?.data,
          error,
        );
      }
    });
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    if (job.name !== 'send-email') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const { template, to, subject, context } = job.data;

    this.logger.log(
      `Processing email job ${job.id}: template=${template}, to=${to}`,
    );

    // Try DB template first (both languages), fallback to hardcoded
    let text: string;
    let html: string | undefined;
    let finalSubject = subject;
    let bodyEn = '';
    let bodyAr = '';

    try {
      const enResult = await this.emailTemplatesService.renderTemplate(
        template,
        context,
        'en',
      );
      const arResult = await this.emailTemplatesService.renderTemplate(
        template,
        context,
        'ar',
      );
      if (enResult && arResult) {
        finalSubject = `${enResult.subject} | ${arResult.subject}`;
        bodyEn = enResult.body;
        bodyAr = arResult.body;
        text = `${bodyEn}\n\n---\n\n${bodyAr}\n\n— CareKit`;
      } else {
        text = buildPlainText(template, context);
      }
    } catch {
      text = buildPlainText(template, context);
    }

    // Build HTML version with layout (header/footer)
    if (bodyEn && bodyAr) {
      try {
        const layoutConfig = await this.getLayoutConfig();
        html = buildHtmlEmail(bodyEn, bodyAr, layoutConfig);
      } catch (err) {
        this.logger.warn(
          `Failed to build HTML email, sending text-only: ${err}`,
        );
      }
    }

    await this.mailerService.sendMail({
      to,
      subject: finalSubject,
      text,
      html,
    });

    this.logger.log(`Email sent successfully: job ${job.id} to ${to}`);
  }

  private async getLayoutConfig(): Promise<EmailLayoutConfig> {
    const [branding, settings] = await Promise.all([
      this.whitelabelService.get(),
      this.clinicSettingsService.get(),
    ]);
    return {
      clinicName: branding.systemName || 'CareKit',
      clinicNameAr: branding.systemNameAr || branding.systemName || 'CareKit',
      logoUrl: branding.logoUrl || '',
      primaryColor: branding.primaryColor || '#2563EB',
      showLogo: settings.emailHeaderShowLogo,
      showName: settings.emailHeaderShowName,
      footerPhone: settings.emailFooterPhone || '',
      footerWebsite: settings.emailFooterWebsite || '',
      footerInstagram: settings.emailFooterInstagram || '',
      footerTwitter: settings.emailFooterTwitter || '',
      footerSnapchat: settings.emailFooterSnapchat || '',
      footerTiktok: settings.emailFooterTiktok || '',
      footerLinkedin: settings.emailFooterLinkedin || '',
      footerYoutube: settings.emailFooterYoutube || '',
    };
  }
}
