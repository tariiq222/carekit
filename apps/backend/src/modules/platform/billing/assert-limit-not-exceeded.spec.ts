import { ForbiddenException } from '@nestjs/common';
import { assertLimitNotExceeded } from './assert-limit-not-exceeded';

type AnyCount = { count: jest.Mock };

function makeTx(): {
  branch: AnyCount;
  employee: AnyCount;
  booking: AnyCount;
} {
  return {
    branch: { count: jest.fn() },
    employee: { count: jest.fn() },
    booking: { count: jest.fn() },
  };
}

describe('assertLimitNotExceeded', () => {
  it('returns silently when no subscription cached', async () => {
    const tx = makeTx();
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'BRANCHES', undefined),
    ).resolves.toBeUndefined();
    expect(tx.branch.count).not.toHaveBeenCalled();
  });

  it('returns silently when limit is -1 (unlimited)', async () => {
    const tx = makeTx();
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'BRANCHES', { maxBranches: -1 }),
    ).resolves.toBeUndefined();
    expect(tx.branch.count).not.toHaveBeenCalled();
  });

  it('returns silently when count is at the limit (the inserted row is the Nth, still allowed)', async () => {
    const tx = makeTx();
    tx.branch.count.mockResolvedValue(3);
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'BRANCHES', { maxBranches: 3 }),
    ).resolves.toBeUndefined();
  });

  it('throws ForbiddenException with PLAN_LIMIT_REACHED metadata when count exceeds the limit', async () => {
    const tx = makeTx();
    tx.branch.count.mockResolvedValue(4); // race: two concurrent inserts both passed pre-check
    try {
      await assertLimitNotExceeded(tx as never, 'org-1', 'BRANCHES', { maxBranches: 3 });
      throw new Error('Expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        limitKind: 'BRANCHES',
        current: 4,
        limit: 3,
      });
    }
  });

  it('uses tx.employee.count for EMPLOYEES kind', async () => {
    const tx = makeTx();
    tx.employee.count.mockResolvedValue(11);
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'EMPLOYEES', { maxEmployees: 10 }),
    ).rejects.toThrow('Plan limit reached for EMPLOYEES: 11/10');
    expect(tx.employee.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true },
    });
  });

  it('uses tx.booking.count for BOOKINGS_PER_MONTH kind, scoped to current month', async () => {
    const tx = makeTx();
    tx.booking.count.mockResolvedValue(101);
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'BOOKINGS_PER_MONTH', { maxBookingsPerMonth: 100 }),
    ).rejects.toThrow('Plan limit reached for BOOKINGS_PER_MONTH: 101/100');
    expect(tx.booking.count).toHaveBeenCalledTimes(1);
    const call = tx.booking.count.mock.calls[0][0] as { where: { scheduledAt?: { gte: Date } } };
    expect(call.where.scheduledAt?.gte).toBeInstanceOf(Date);
  });

  it('treats limit=0 as "not configured" and skips the check (no false-positive denial)', async () => {
    const tx = makeTx();
    await expect(
      assertLimitNotExceeded(tx as never, 'org-1', 'BRANCHES', { maxBranches: 0 }),
    ).resolves.toBeUndefined();
    expect(tx.branch.count).not.toHaveBeenCalled();
  });
});
