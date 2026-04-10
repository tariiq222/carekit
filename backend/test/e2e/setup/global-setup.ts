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

    // Chatbot: messages before sessions, KB chunks before files
    await prisma.chatMessage.deleteMany({});
    await prisma.chatSession.deleteMany({});
    await prisma.knowledgeBase.deleteMany({});
    await prisma.knowledgeBaseFile.deleteMany({});

    // Ratings
    await prisma.rating.deleteMany({});

    await prisma.couponRedemption.deleteMany({});
    await prisma.coupon.deleteMany({});
    await prisma.giftCardTransaction.deleteMany({});
    await prisma.giftCard.deleteMany({});
    await prisma.intakeResponse.deleteMany({});
    await prisma.intakeField.deleteMany({});
    await prisma.intakeForm.deleteMany({});
     await prisma.practitionerBranch.deleteMany({});
     // Delete branch-specific booking settings before deleting branches (FK constraint)
     await prisma.bookingSettings.deleteMany({ where: { branchId: { not: null } } });
     // Delete branch-specific practitioner availabilities
     await prisma.practitionerAvailability.deleteMany({ where: { branchId: { not: null } } });
     await prisma.branch.deleteMany({ where: { isMain: false } });
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

    // Seed emails that must be preserved (matches prisma/seed.demo-data.ts).
    // These are demo seed users that tests depend on but don't manage themselves.
    // NOTE: reception@carekit-test.com and accountant@carekit-test.com are intentionally
    // excluded here because the e2e tests re-create them via createTestUserWithRole.
    const seedEmails = [
      'admin@carekit-test.com',
      // Demo practitioners (linked to seeded specialties — needed for cascade-protection tests)
      'dr.abdulrahman@carekit-test.com',
      'dr.layla@carekit-test.com',
      'dr.fahad@carekit-test.com',
      'dr.hanan@carekit-test.com',
      // Demo patients (example.com — no phone conflict with test users)
      'sara.ahmed@example.com',
      'omar.ali@example.com',
      'noura.hassan@example.com',
      'youssef.ibrahim@example.com',
      'fatima.saeed@example.com',
      'khaled.nasser@example.com',
      'mona.rashid@example.com',
      'ahmed.sultan@example.com',
      'lama.turki@example.com',
      'faisal.majed@example.com',
    ];

    const nonSeedUsers = await prisma.user.findMany({
      where: { email: { notIn: seedEmails } },
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

        // Delete group session enrollments + sessions referencing these practitioners
        // (GroupSession.practitioner has onDelete: Restrict)
        const groupSessions = await prisma.groupSession.findMany({
          where: { practitionerId: { in: practitionerIds } },
          select: { id: true },
        });
        const groupSessionIds = groupSessions.map((gs) => gs.id);

        if (groupSessionIds.length > 0) {
          await prisma.groupEnrollment.deleteMany({
            where: { groupSessionId: { in: groupSessionIds } },
          });
          await prisma.groupSession.deleteMany({
            where: { id: { in: groupSessionIds } },
          });
        }
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

    // Delete test-created services (practitionerService must precede service due to FK)
    await prisma.practitionerServiceType.deleteMany({});
    await prisma.practitionerService.deleteMany({});
    await prisma.service.deleteMany({});

    // Delete test-created service categories
    await prisma.serviceCategory.deleteMany({});

    // Delete test-created specialties (keep only canonical seed specialties)
    const seedSpecialtyNames = [
      'General Medicine', 'Dermatology', 'Pediatrics', 'Dentistry',
      'Cardiology', 'Orthopedics', 'Ophthalmology', 'Psychiatry',
    ];
    await prisma.specialty.deleteMany({
      where: { nameEn: { notIn: seedSpecialtyNames } },
    });

    // Clean admin's refresh tokens too
    await prisma.refreshToken.deleteMany({});

    console.log('E2E test database cleaned successfully');
  } finally {
    await prisma.$disconnect();
  }
}
