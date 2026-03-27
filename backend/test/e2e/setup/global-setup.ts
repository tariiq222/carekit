/**
 * Global setup for e2e tests.
 * Cleans up test-specific data from previous runs while preserving seed data.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';

export default async function globalSetup(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for e2e tests');
  }

  // Flush Redis so throttle counters from previous runs don't block auth requests.
  // The test Redis (port 5380) is dedicated to testing — safe to flush entirely.
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  try {
    await redis.flushdb();
  } finally {
    await redis.quit();
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Delete test-created module data (order matters due to foreign keys)
    await prisma.couponRedemption.deleteMany({});
    await prisma.coupon.deleteMany({});
    await prisma.giftCardTransaction.deleteMany({});
    await prisma.giftCard.deleteMany({});
    await prisma.intakeResponse.deleteMany({});
    await prisma.intakeField.deleteMany({});
    await prisma.intakeForm.deleteMany({});
    await prisma.practitionerBranch.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.clinicWorkingHours.deleteMany({});
    await prisma.clinicHoliday.deleteMany({});
    await prisma.problemReport.deleteMany({});
    await prisma.activityLog.deleteMany({});

    // Delete test users (not the seeded super_admin)
    // Order matters due to foreign keys
    await prisma.notification.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    // Delete invoices before payments/bookings (invoices.payment_id has ON DELETE RESTRICT)
    await prisma.invoice.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.otpCode.deleteMany({});

    // Delete non-seed users (keep the seeded admin)
    const seedAdminEmail = 'admin@carekit-test.com';
    const nonSeedUsers = await prisma.user.findMany({
      where: { email: { not: seedAdminEmail } },
      select: { id: true },
    });

    const nonSeedUserIds = nonSeedUsers.map((u) => u.id);

    if (nonSeedUserIds.length > 0) {
      // Delete vacation records for practitioners of non-seed users
      const practitioners = await prisma.practitioner.findMany({
        where: { userId: { in: nonSeedUserIds } },
        select: { id: true },
      });
      const practitionerIds = practitioners.map((p) => p.id);

      if (practitionerIds.length > 0) {
        await prisma.practitionerVacation.deleteMany({
          where: { practitionerId: { in: practitionerIds } },
        });
        await prisma.practitionerAvailability.deleteMany({
          where: { practitionerId: { in: practitionerIds } },
        });
      }

      // Delete practitioner records for non-seed users
      await prisma.practitioner.deleteMany({
        where: { userId: { in: nonSeedUserIds } },
      });

      // Delete user roles for non-seed users
      await prisma.userRole.deleteMany({
        where: { userId: { in: nonSeedUserIds } },
      });

      // Delete the users themselves
      await prisma.user.deleteMany({
        where: { id: { in: nonSeedUserIds } },
      });
    }

    // Delete non-system roles (custom roles from previous test runs)
    await prisma.rolePermission.deleteMany({
      where: { role: { isSystem: false } },
    });
    await prisma.role.deleteMany({
      where: { isSystem: false },
    });

    // Delete test-created services (soft-deleted or otherwise)
    await prisma.service.deleteMany({});

    // Delete test-created service categories
    await prisma.serviceCategory.deleteMany({});

    // Clean admin's refresh tokens too
    await prisma.refreshToken.deleteMany({});

    console.log('E2E test database cleaned successfully');
  } finally {
    await prisma.$disconnect();
  }
}
