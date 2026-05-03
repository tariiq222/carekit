import { ForbiddenException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { LimitKind } from './plan-limits.decorator';
import { startOfMonthUTC } from './usage-counter/period.util';

/**
 * Recheck a hard-cap plan limit AFTER the new row was inserted, but BEFORE
 * the surrounding transaction commits.
 *
 * Combined with the pre-create `PlanLimitsGuard` this closes the TOCTOU race
 * where two concurrent requests at limit-1 both pass the guard's count check.
 * The second request now sees the just-inserted competing row inside its own
 * transaction (because it queries the same `tx`), and we throw → the
 * surrounding `prisma.$transaction` rolls back the insert.
 *
 * Caller contract: invoke INSIDE the same `tx` that inserted the row, AFTER
 * the insert. The thrown `ForbiddenException` will propagate out and abort
 * the transaction.
 *
 * `limits` is the plan-limits JSON pulled from the org subscription. `-1`
 * means unlimited and skips the check.
 */
export async function assertLimitNotExceeded(
  tx: Prisma.TransactionClient,
  organizationId: string,
  kind: LimitKind,
  limits: Record<string, number | boolean> | undefined,
): Promise<void> {
  if (!limits) return; // no subscription cached → permissive (dev/trial)

  const limit = resolveLimit(kind, limits);
  if (limit === -1) return; // unlimited
  if (limit <= 0) return; // 0 or negative-non-(-1) means cap not configured

  const current = await currentUsage(tx, kind, organizationId);
  if (current > limit) {
    throw new ForbiddenException({
      code: 'PLAN_LIMIT_REACHED',
      limitKind: kind,
      current,
      limit,
      message: `Plan limit reached for ${kind}: ${current}/${limit}`,
    });
  }
}

function resolveLimit(
  kind: LimitKind,
  limits: Record<string, number | boolean>,
): number {
  switch (kind) {
    case 'BRANCHES': return Number(limits['maxBranches'] ?? 0);
    case 'EMPLOYEES': return Number(limits['maxEmployees'] ?? 0);
    case 'BOOKINGS_PER_MONTH': return Number(limits['maxBookingsPerMonth'] ?? 0);
    case 'STORAGE_MB': return Number(limits['maxStorageMB'] ?? 0);
  }
}

/**
 * Always queries the source-of-truth tables — never UsageCounter — because
 * UsageCounter is updated asynchronously by `IncrementUsageListener`, which
 * may not have run yet by the time this post-create check fires.
 *
 * The query MUST run on the supplied `tx` so it sees the just-inserted row
 * under READ COMMITTED (or stricter) isolation.
 */
async function currentUsage(
  tx: Prisma.TransactionClient,
  kind: LimitKind,
  organizationId: string,
): Promise<number> {
  switch (kind) {
    case 'BRANCHES':
      return tx.branch.count({ where: { organizationId, isActive: true } });
    case 'EMPLOYEES':
      return tx.employee.count({ where: { organizationId, isActive: true } });
    case 'BOOKINGS_PER_MONTH':
      return tx.booking.count({
        where: {
          organizationId,
          scheduledAt: { gte: startOfMonthUTC() },
          status: { not: BookingStatus.CANCELLED },
        },
      });
    case 'STORAGE_MB': {
      const result = await tx.file.aggregate({
        where: { organizationId, isDeleted: false },
        _sum: { size: true },
      });
      const bytes = result._sum.size ?? 0;
      return Math.ceil(bytes / (1024 * 1024));
    }
  }
}
