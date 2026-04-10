import { BadRequestException } from '@nestjs/common';
import { validateAvailability } from '../booking-validation.helper';

// ─── Types ───────────────────────────────────────────────────────────────────────

/** Extract the prisma parameter type from the function signature. */
type PrismaArg = Parameters<typeof validateAvailability>[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock that satisfies the PrismaArg contract.
 * Justified cast: test mock provides only the subset of methods
 * that validateAvailability accesses at runtime.
 */
function createMockPrisma() {
  return {
    practitionerVacation: { findFirst: jest.fn().mockResolvedValue(null) },
    practitionerAvailability: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaArg;
}

/** Asserts that `promise` rejects with a BadRequestException carrying the exact error code. */
async function expectBadRequest(
  promise: Promise<void>,
  error: string,
  message: string,
): Promise<void> {
  try {
    await promise;
    expect.unreachable('Expected BadRequestException but nothing was thrown');
  } catch (e: unknown) {
    expect(e).toBeInstanceOf(BadRequestException);
    const ex = e as BadRequestException; // guarded by instanceof above
    expect(ex.getResponse()).toEqual({ statusCode: 400, message, error });
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────────

describe('validateAvailability', () => {
  // Wednesday 15 April 2026
  const date = new Date(2026, 3, 15);

  it('throws PRACTITIONER_ON_VACATION when practitioner is on vacation', async () => {
    const prisma = createMockPrisma();
    (prisma.practitionerVacation.findFirst as jest.Mock).mockResolvedValue({
      id: 'v1',
      practitionerId: 'p1',
      startDate: new Date(2026, 3, 14),
      endDate: new Date(2026, 3, 16),
    });

    await expectBadRequest(
      validateAvailability(prisma, 'p1', date, '10:00', '11:00'),
      'PRACTITIONER_ON_VACATION',
      'Practitioner is on vacation on this date',
    );
  });

  it('throws NOT_AVAILABLE when no availability records exist for that day', async () => {
    const prisma = createMockPrisma();

    await expectBadRequest(
      validateAvailability(prisma, 'p1', date, '10:00', '11:00'),
      'NOT_AVAILABLE',
      'Practitioner is not available on this day',
    );
  });

  it('throws OUTSIDE_AVAILABILITY when requested time falls outside hours', async () => {
    const prisma = createMockPrisma();
    (prisma.practitionerAvailability.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        dayOfWeek: date.getDay(),
        startTime: '09:00',
        endTime: '12:00',
        isActive: true,
      },
    ]);

    await expectBadRequest(
      validateAvailability(prisma, 'p1', date, '13:00', '14:00'),
      'OUTSIDE_AVAILABILITY',
      'Requested time is outside practitioner availability hours',
    );
  });

  it('resolves without throwing when time is within availability', async () => {
    const prisma = createMockPrisma();
    (prisma.practitionerAvailability.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        dayOfWeek: date.getDay(),
        startTime: '08:00',
        endTime: '17:00',
        isActive: true,
      },
    ]);

    await expect(
      validateAvailability(prisma, 'p1', date, '10:00', '11:00'),
    ).resolves.toBeUndefined();
  });

  it('passes OR filter with branchId and null when branchId is supplied', async () => {
    const prisma = createMockPrisma();
    (prisma.practitionerAvailability.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        dayOfWeek: date.getDay(),
        startTime: '08:00',
        endTime: '17:00',
        branchId: 'b1',
        isActive: true,
      },
    ]);

    await validateAvailability(prisma, 'p1', date, '09:00', '10:00', 'b1');

    const callArgs = (prisma.practitionerAvailability.findMany as jest.Mock)
      .mock.calls;
    const where = callArgs[0][0].where as Record<string, unknown>;

    expect(where).toMatchObject({
      practitionerId: 'p1',
      dayOfWeek: date.getDay(),
      isActive: true,
      OR: [{ branchId: 'b1' }, { branchId: null }],
    });
  });
});
