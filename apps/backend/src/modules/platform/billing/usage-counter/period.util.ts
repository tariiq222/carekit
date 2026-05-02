/**
 * Period helpers for UsageCounter rows.
 *
 * monthly_bookings  → periodStart = first day of current UTC month.
 * All other keys    → periodStart = EPOCH (accumulate, never reset).
 */

export const EPOCH = new Date('1970-01-01T00:00:00.000Z');

export function startOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Compute the (exclusive) end of the period for a given periodStart.
 * Returns null for EPOCH-based periods (no natural end).
 */
export function periodEndUTC(periodStart: Date): Date | null {
  if (periodStart.getTime() === EPOCH.getTime()) return null;
  // Assume monthly: add one month
  return new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
  );
}
