/**
 * Emitted after a Plan record changes (admin create or update).
 * Multiple tenants may share a plan, so all affected org caches must be purged.
 */
export interface PlanUpdatedPayload {
  planId: string;
  affectedOrganizationIds: string[];
}

export const PLAN_UPDATED_EVENT = 'billing.plan.updated';
