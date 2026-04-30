import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Subscription lifecycle state machine (SaaS-04).
 *
 * ┌───────────┐
 * │ TRIALING  │ ─ cancel ─────────────────────────────────────→ CANCELED
 * └─────┬─────┘
 *       │ chargeSuccess (first tokenized-card charge)
 *       ▼
 * ┌───────────┐                                             ┌───────────┐
 * │  ACTIVE   │ ─ cancel ────────────────────────────────→  │ CANCELED  │
 * └──┬─────┬──┘                                             └───────────┘
 *    │     │ chargeFailure (sets pastDueSince)
 *    │     ▼
 *    │  ┌───────────┐  graceExpired (pastDueSince + grace)  ┌───────────┐
 *    │  │ PAST_DUE  │ ──────────────────────────────────→   │ SUSPENDED │
 *    │  └────┬──────┘                                       └─────┬─────┘
 *    │       │ chargeSuccess (clears pastDueSince)                │
 *    │       ▼                                                    │ resumeSuccess
 *    │    ACTIVE ←──────────────────────────────────────────────── ┘
 *    │
 *    └── upgrade / downgrade (self-loop; prorated invoice issued)
 *
 * Grace period: `SAAS_GRACE_PERIOD_DAYS` env (default 2). The cron
 * `enforce-grace-period.cron.ts` inspects `pastDueSince` and fires
 * `graceExpired` when `now() >= pastDueSince + graceDays`.
 *
 * CANCELED is terminal. `retryCount` on the subscription row is kept for
 * analytics only — it does NOT drive transitions (decision recorded in plan
 * preamble, 2026-04-22).
 */
export type SubscriptionEvent =
  | { type: 'chargeSuccess' }
  | { type: 'chargeFailure' }
  | { type: 'graceExpired' }
  | { type: 'resumeSuccess' }
  | { type: 'cancel' }
  | { type: 'upgrade' }
  | { type: 'downgrade' }
  | { type: 'trialExpired' };

export type SubscriptionEventType = SubscriptionEvent['type'];

type TransitionMap = Record<
  SubscriptionStatus,
  Partial<Record<SubscriptionEventType, SubscriptionStatus>>
>;

/**
 * Source of truth for allowed transitions. Anything not listed throws.
 * Keep in sync with the plan preamble "Transition table" in
 * docs/superpowers/plans/2026-04-21-saas-04-billing-subscriptions.md.
 */
export const TRANSITIONS: TransitionMap = {
  TRIALING: {
    chargeSuccess: 'ACTIVE',
    chargeFailure: 'PAST_DUE',
    trialExpired: 'SUSPENDED',
    cancel: 'CANCELED',
  },
  ACTIVE: {
    chargeFailure: 'PAST_DUE',
    cancel: 'CANCELED',
    upgrade: 'ACTIVE',
    downgrade: 'ACTIVE',
  },
  PAST_DUE: {
    chargeSuccess: 'ACTIVE',
    graceExpired: 'SUSPENDED',
    cancel: 'CANCELED',
  },
  SUSPENDED: {
    resumeSuccess: 'ACTIVE',
    cancel: 'CANCELED',
  },
  CANCELED: {},
};

@Injectable()
export class SubscriptionStateMachine {
  /**
   * Compute the next status. Throws on illegal transitions — callers should
   * treat illegal transitions as a programmer error, not a runtime-recoverable
   * condition. Webhook handlers should call `canTransition` first if they need
   * to swallow duplicates.
   */
  transition(from: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
    const next = TRANSITIONS[from]?.[event.type];
    if (!next) {
      throw new Error(`Illegal subscription transition from ${from} on ${event.type}`);
    }
    return next;
  }

  canTransition(from: SubscriptionStatus, eventType: SubscriptionEventType): boolean {
    return Boolean(TRANSITIONS[from]?.[eventType]);
  }
}
