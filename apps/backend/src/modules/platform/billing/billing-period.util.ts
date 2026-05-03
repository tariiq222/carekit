/**
 * UTC-safe month arithmetic for billing periods.
 *
 * Mirrors `date-fns/addMonths` semantics for our two billing cycles
 * without adding a runtime dependency. Clamps the day-of-month so that
 * advancing 2026-01-31 by one month yields 2026-02-28 (not 2026-03-03).
 *
 * Internal — used by:
 *   - record-subscription-payment.handler.ts (advance currentPeriodEnd
 *     after a successful charge to prevent double-billing — Bug B2)
 *   - billing-period.util.spec.ts
 */
export function addMonthsUtc(input: Date, months: number): Date {
  const year = input.getUTCFullYear();
  const month = input.getUTCMonth();
  const day = input.getUTCDate();
  const hours = input.getUTCHours();
  const minutes = input.getUTCMinutes();
  const seconds = input.getUTCSeconds();
  const millis = input.getUTCMilliseconds();

  const targetMonthAbs = month + months;
  const targetYear = year + Math.floor(targetMonthAbs / 12);
  const targetMonth = ((targetMonthAbs % 12) + 12) % 12;

  // Clamp day-of-month to last day of the target month (UTC).
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds, millis),
  );
}

/**
 * Advance a billing period end by one full cycle.
 *
 * If the current period end is already in the past (e.g. trial expired
 * weeks ago, or the cron lagged), advance from `now` instead so we don't
 * land in the past again and re-trigger the "due" cron immediately.
 */
export function advanceBillingPeriodEnd(
  currentPeriodEnd: Date,
  billingCycle: 'MONTHLY' | 'ANNUAL',
  now: Date = new Date(),
): Date {
  const base = currentPeriodEnd.getTime() < now.getTime() ? now : currentPeriodEnd;
  const months = billingCycle === 'ANNUAL' ? 12 : 1;
  return addMonthsUtc(base, months);
}
