import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MetricsService } from '../../common/metrics/metrics.service.js';

// Retention windows
const WEBHOOK_RETAIN_DAYS   = 30; // keep processed webhooks for 30 days (idempotency window)
const ACTIVITY_ARCHIVE_DAYS = 90; // archive activity logs older than 90 days

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Auth cleanup
  // ─────────────────────────────────────────────────────────────

  async cleanExpiredOtps() {
    const result = await this.prisma.otpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired/used OTP codes`);
    }
  }

  async cleanExpiredRefreshTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired refresh tokens`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Payment idempotency cleanup
  // Processed webhooks older than WEBHOOK_RETAIN_DAYS are safe to delete.
  // Moyasar doesn't replay webhooks beyond a few days.
  // ─────────────────────────────────────────────────────────────

  async cleanOldProcessedWebhooks() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WEBHOOK_RETAIN_DAYS);

    const result = await this.prisma.processedWebhook.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} processed webhooks older than ${WEBHOOK_RETAIN_DAYS} days`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Activity log archiving
  // Rows older than ACTIVITY_ARCHIVE_DAYS are moved to activity_logs_archive.
  // Uses raw SQL for bulk INSERT + DELETE in one transaction (no ORM overhead).
  // Falls back gracefully if archive table doesn't exist yet.
  // ─────────────────────────────────────────────────────────────

  async archiveOldActivityLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ACTIVITY_ARCHIVE_DAYS);

    try {
      const result = await this.prisma.$executeRaw`
        WITH archived AS (
          INSERT INTO activity_logs_archive
            SELECT * FROM activity_logs
            WHERE created_at < ${cutoff}
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        )
        DELETE FROM activity_logs
        WHERE id IN (SELECT id FROM archived)
      `;
      if (result > 0) {
        this.logger.log(`Archived ${result} activity logs older than ${ACTIVITY_ARCHIVE_DAYS} days`);
      }
    } catch (err) {
      // Archive table may not exist yet — log warning, don't crash the worker
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('activity_logs_archive') && msg.includes('does not exist')) {
        this.logger.warn(
          'activity_logs_archive table not found — skipping archiving. ' +
          'Run migration to create it when ready.',
        );
      } else {
        throw err;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Rating consistency repair
  // Recalculates rating + reviewCount for all active practitioners.
  // Guards against drift caused by soft-deleted ratings or missed updates.
  // Runs weekly — not a substitute for real-time updates in RatingsService.
  // ─────────────────────────────────────────────────────────────

  async repairPractitionerRatingCache() {
    const practitioners = await this.prisma.practitioner.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, rating: true, reviewCount: true },
    });

    let repaired = 0;

    for (const practitioner of practitioners) {
      const stats = await this.prisma.rating.aggregate({
        where: { practitionerId: practitioner.id, deletedAt: null },
        _avg: { stars: true },
        _count: { id: true },
      });

      const expectedRating = Math.round((stats._avg.stars ?? 0) * 100) / 100;
      const expectedCount  = stats._count.id;

      const drifted =
        Math.abs(practitioner.rating - expectedRating) > 0.01 ||
        practitioner.reviewCount !== expectedCount;

      if (drifted) {
        await this.prisma.practitioner.update({
          where: { id: practitioner.id },
          data: { rating: expectedRating, reviewCount: expectedCount },
        });
        repaired++;
      }
    }

    if (repaired > 0) {
      this.logger.warn(`Rating cache repaired for ${repaired} practitioners`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DB health snapshot — table row counts for monitoring
  // Emits a structured JSON log line scraped by log aggregator or Grafana.
  // ─────────────────────────────────────────────────────────────

  async logTableGrowthSnapshot() {
    const [bookings, payments, activityLogs, notifications, chatMessages, otpCodes] =
      await Promise.all([
        this.prisma.booking.count(),
        this.prisma.payment.count(),
        this.prisma.activityLog.count(),
        this.prisma.notification.count(),
        this.prisma.chatMessage.count(),
        this.prisma.otpCode.count(),
      ]);

    // Update Prometheus Gauges for Grafana monitoring
    this.metricsService.dbTableRows.set({ table: 'bookings' }, bookings);
    this.metricsService.dbTableRows.set({ table: 'payments' }, payments);
    this.metricsService.dbTableRows.set({ table: 'activity_logs' }, activityLogs);
    this.metricsService.dbTableRows.set({ table: 'notifications' }, notifications);
    this.metricsService.dbTableRows.set({ table: 'chat_messages' }, chatMessages);
    this.metricsService.dbTableRows.set({ table: 'otp_codes' }, otpCodes);

    this.logger.log(
      JSON.stringify({
        event: 'table_growth_snapshot',
        tables: { bookings, payments, activityLogs, notifications, chatMessages, otpCodes },
        ts: new Date().toISOString(),
      }),
    );
  }
}
