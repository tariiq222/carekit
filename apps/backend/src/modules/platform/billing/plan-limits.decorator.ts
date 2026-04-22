import { SetMetadata } from '@nestjs/common';

export type LimitKind = 'BRANCHES' | 'EMPLOYEES';
export const ENFORCE_LIMIT_KEY = 'plan-limits:enforce';
export const EnforceLimit = (kind: LimitKind) => SetMetadata(ENFORCE_LIMIT_KEY, kind);
