import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { LaunchFlags } from '../../platform/billing/feature-flags/launch-flags';

@Injectable()
export class BookingExpiryCron {
  private readonly logger = new Logger(BookingExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LaunchFlags,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    if (!this.flags.bookingExpiryEnabled) {
      return this.legacyExpire();
    }
    return this.enhancedExpire();
  }

  /**
   * Legacy path used when BOOKING_EXPIRY_CRON_ENABLED is off. Preserves
   * the pre-launch-readiness behavior so the flag flip is the only thing
   * that activates the new cross-tenant cron.
   */
  private async legacyExpire(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: { status: BookingStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`expired ${result.count} bookings (legacy)`);
    }
  }

  private async enhancedExpire(): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      this.logger.log('systemContext: booking-expiry tick');

      const now = new Date();
      const stale = await this.prisma.$allTenants.booking.findMany({
        where: {
          expiresAt: { lt: now },
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.AWAITING_PAYMENT,
              BookingStatus.PENDING_GROUP_FILL,
            ],
          },
        },
        select: { id: true, organizationId: true, couponCode: true },
      });
      if (stale.length === 0) return;

      const ids = stale.map((b) => b.id);
      await this.prisma.$allTenants.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: BookingStatus.EXPIRED },
      });

      // One decrement per booking that had a coupon — mirrors the
      // increment-on-create semantics in create-booking.handler.ts (Feature 2).
      for (const b of stale) {
        if (!b.couponCode) continue;
        await this.prisma.$allTenants.coupon.updateMany({
          where: {
            code: b.couponCode,
            organizationId: b.organizationId,
            usedCount: { gt: 0 },
          },
          data: { usedCount: { decrement: 1 } },
        });
      }

      this.logger.log(`expired ${ids.length} bookings`);
    });
  }
}
