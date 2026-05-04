import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlanLimitsGuard } from './enforce-limits.guard';

/**
 * Hard-cap LimitKinds — these block the creation of more rows when the plan
 * limit is reached. PRE-CREATE check via `@EnforceLimit` (this decorator) +
 * POST-CREATE check via `@PostCreateLimitCheck` close the TOCTOU race.
 */
export type LimitKind =
  | 'BRANCHES'
  | 'EMPLOYEES'
  | 'BOOKINGS_PER_MONTH';

export const ENFORCE_LIMIT_KEY = 'plan-limits:enforce';

export const EnforceLimit = (kind: LimitKind) =>
  applyDecorators(
    SetMetadata(ENFORCE_LIMIT_KEY, kind),
    UseGuards(PlanLimitsGuard),
  );
