import { Injectable } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UsageCounterService } from '../usage-counter/usage-counter.service';
import { EPOCH, startOfMonthUTC } from '../usage-counter/period.util';

/**
 * Phase 2 / Bug B8 — Downgrade safety pre-check.
 *
 * Compares current organization usage against a candidate target plan's hard
 * caps. If any current count exceeds the target's limit, the downgrade is
 * unsafe — the tenant would be locked out of replacing rows under the
 * EnforceLimit guard once the swap lands.
 *
 * This is enforced at TWO points:
 *   1. At immediate-downgrade time (DowngradePlanHandler).
 *   2. At schedule-downgrade time, AND again when the cron picks up the
 *      scheduled change (process-scheduled-plan-changes.cron).
 */

export type DowngradeLimitKind =
  | typeof FeatureKey.BRANCHES
  | typeof FeatureKey.EMPLOYEES
  | typeof FeatureKey.MONTHLY_BOOKINGS;

export interface DowngradeViolation {
  kind: DowngradeLimitKind;
  current: number;
  targetMax: number;
}

export interface DowngradeCheckResult {
  ok: boolean;
  violations: DowngradeViolation[];
}

interface PlanLimitsLike {
  maxBranches?: number;
  maxEmployees?: number;
  maxBookingsPerMonth?: number;
  [key: string]: unknown;
}

interface PlanLike {
  limits: Prisma.JsonValue | PlanLimitsLike;
}

/**
 * The 4 hard-cap dimensions a downgrade can violate. `services` is excluded
 * intentionally: services are easy to deactivate, and the active count never
 * approaches the cap in practice. Booleans (feature flags) are handled by the
 * separate FeatureGuard once the swap lands.
 */
const HARD_CAP_DIMENSIONS: ReadonlyArray<{
  kind: DowngradeLimitKind;
  jsonKey: keyof PlanLimitsLike;
}> = [
  { kind: FeatureKey.BRANCHES, jsonKey: 'maxBranches' },
  { kind: FeatureKey.EMPLOYEES, jsonKey: 'maxEmployees' },
  { kind: FeatureKey.MONTHLY_BOOKINGS, jsonKey: 'maxBookingsPerMonth' },
];

@Injectable()
export class DowngradeSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: UsageCounterService,
  ) {}

  /**
   * Check whether moving from `currentPlan` to `targetPlan` is safe given the
   * organization's present usage. `-1` on either side is treated as unlimited
   * and never triggers a violation.
   *
   * Reads materialized UsageCounter rows; if the row is missing (cold start),
   * falls back to a live count from the source-of-truth tables.
   */
  async checkDowngrade(
    _currentPlan: PlanLike,
    targetPlan: PlanLike,
    organizationId: string,
  ): Promise<DowngradeCheckResult> {
    const targetLimits = readLimits(targetPlan);
    const violations: DowngradeViolation[] = [];

    for (const { kind, jsonKey } of HARD_CAP_DIMENSIONS) {
      const targetMax = readNumericLimit(targetLimits, jsonKey);
      if (targetMax < 0) continue; // unlimited target — never violates

      const current = await this.readCurrentUsage(kind, organizationId);
      if (current > targetMax) {
        violations.push({ kind, current, targetMax });
      }
    }

    return { ok: violations.length === 0, violations };
  }

  private async readCurrentUsage(
    kind: DowngradeLimitKind,
    organizationId: string,
  ): Promise<number> {
    const period = kind === FeatureKey.MONTHLY_BOOKINGS ? startOfMonthUTC() : EPOCH;
    const cached = await this.counters.read(organizationId, kind, period);
    if (cached !== null) return cached;
    return this.recomputeFromSource(kind, organizationId);
  }

  private async recomputeFromSource(
    kind: DowngradeLimitKind,
    organizationId: string,
  ): Promise<number> {
    switch (kind) {
      case FeatureKey.BRANCHES:
        return this.prisma.$allTenants.branch.count({
          where: { organizationId, isActive: true },
        });
      case FeatureKey.EMPLOYEES:
        return this.prisma.$allTenants.employee.count({
          where: { organizationId, isActive: true },
        });
      case FeatureKey.MONTHLY_BOOKINGS: {
        const startOfMonth = startOfMonthUTC();
        return this.prisma.$allTenants.booking.count({
          where: {
            organizationId,
            scheduledAt: { gte: startOfMonth },
            status: { not: BookingStatus.CANCELLED },
          },
        });
      }
      default:
        return 0;
    }
  }
}

function readLimits(plan: PlanLike): PlanLimitsLike {
  const raw = plan.limits;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as PlanLimitsLike;
  }
  return {};
}

function readNumericLimit(limits: PlanLimitsLike, key: keyof PlanLimitsLike): number {
  const v = limits[key];
  return typeof v === 'number' ? v : -1;
}
