import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { buildPlainText } from './email.helpers.js';

interface SendEmailJobData {
  template: string;
  to: string;
  subject: string;
  context: Record<string, unknown>;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
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

    const text = buildPlainText(template, context);

    await this.mailerService.sendMail({ to, subject, text });

    this.logger.log(`Email sent successfully: job ${job.id} to ${to}`);
  }
}
