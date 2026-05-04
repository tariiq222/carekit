import { SetMetadata } from '@nestjs/common';

export type UsageMetricKind = 'BOOKINGS_PER_MONTH' | 'CLIENTS';
export const TRACK_USAGE_KEY = 'usage-tracker:metric';
export const TrackUsage = (kind: UsageMetricKind) => SetMetadata(TRACK_USAGE_KEY, kind);
