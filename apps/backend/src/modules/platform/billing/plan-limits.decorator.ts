import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlanLimitsGuard } from './enforce-limits.guard';

export type LimitKind = 'BRANCHES' | 'EMPLOYEES';
export const ENFORCE_LIMIT_KEY = 'plan-limits:enforce';

export const EnforceLimit = (kind: LimitKind) =>
  applyDecorators(
    SetMetadata(ENFORCE_LIMIT_KEY, kind),
    UseGuards(PlanLimitsGuard),
  );
