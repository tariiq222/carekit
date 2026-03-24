import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { ADMIN_ROLE_SLUGS } from '../../config/constants/roles.js';

@Injectable()
export class QueueFailureService {
  private readonly logger = new Logger(QueueFailureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Notify all active admin users when a BullMQ job exhausts its retries.
   * Uses Promise.allSettled so one admin's failure never blocks others.
   * Entire method is wrapped in try/catch — notification failures must NEVER crash the worker.
   */
  async notifyAdminsOfFailure(
    queueName: string,
    jobName: string,
    jobId: string | undefined,
    jobData: unknown,
    error: Error,
  ): Promise<void> {
    try {
      this.logger.error(
        `[DLQ] Job permanently failed — queue=${queueName} job=${jobName} id=${jobId ?? 'unknown'}`,
        {
          queueName,
          jobName,
          jobId,
          jobData,
          error: error.message,
          stack: error.stack,
        },
      );

      const admins = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          userRoles: {
            some: {
              role: { slug: { in: [...ADMIN_ROLE_SLUGS] } },
            },
          },
        },
        select: { id: true },
      });

      if (admins.length === 0) {
        this.logger.warn('[DLQ] No active admin users found — skipping notification');
        return;
      }

      const truncatedError = error.message.slice(0, 200);
      const results = await Promise.allSettled(
        admins.map((admin) =>
          this.notificationsService.createNotification({
            userId: admin.id,
            type: 'system_alert',
            titleAr: `فشل مهمة في الخلفية: ${queueName}`,
            titleEn: `Background job failed: ${queueName}`,
            bodyAr: `فشلت المهمة "${jobName}" بشكل نهائي بعد استنفاد جميع المحاولات. الخطأ: ${truncatedError}`,
            bodyEn: `Job "${jobName}" permanently failed after exhausting all retries. Error: ${truncatedError}`,
            data: {
              queueName,
              jobName,
              jobId: jobId ?? 'unknown',
            },
          }),
        ),
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        this.logger.warn(
          `[DLQ] Failed to notify ${failed.length}/${admins.length} admins`,
        );
      }
    } catch (err) {
      // Never let notification failure crash the worker
      this.logger.error(
        '[DLQ] Failed to send admin failure notifications',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
