import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { buildPlainText } from './email.helpers.js';
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

    const text = buildPlainText(template, context);

    await this.mailerService.sendMail({ to, subject, text });

    this.logger.log(`Email sent successfully: job ${job.id} to ${to}`);
  }
}
