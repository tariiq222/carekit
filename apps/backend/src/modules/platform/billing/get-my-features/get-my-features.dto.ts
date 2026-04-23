import { PlanSlug, SubscriptionStatus } from "@prisma/client";

/**
 * A single feature entry in the billing features response.
 * Quantitative features include `limit` and `currentCount`.
 */
export class FeatureEntry {
  /** Whether the feature is enabled for this organization. */
  enabled!: boolean;

  /** Plan limit (present for quantitative features). Use `-1` to mean unlimited. */
  limit?: number;

  /** Current usage count (present when `limit` is present). */
  currentCount?: number;
}

/**
 * Full billing features response returned by `GET /dashboard/billing/my-features`.
 *
 * Shape:
 * {
 *   "planSlug": "PRO",
 *   "status": "ACTIVE",
 *   "features": {
 *     "recurring_bookings": { "enabled": true },
 *     "branches": { "enabled": true, "limit": 3, "currentCount": 1 },
 *     ...
 *   }
 * }
 */
export class BillingFeaturesResponse {
  planSlug!: PlanSlug;
  status!: SubscriptionStatus;
  features!: Record<string, FeatureEntry>;
}
