/**
 * Date helpers — locale-aware date formatting for the dashboard.
 *
 * Two layers exist by design:
 *   1. `formatClinicDate(date, format)` in lib/utils.ts — used by booking
 *      tables/columns where the clinic's configured date format
 *      (Y-m-d / d/m/Y / m/d/Y from BrandingConfig) is the source of truth.
 *      Wrapped by `useOrganizationConfig().formatDate` for the common case.
 *   2. `formatLocaleDate(date, locale, options?)` (this file) — used by
 *      free-form list rows / charts / detail sheets where locale matters
 *      more than the clinic's configured format (e.g. month-name labels).
 *
 * Use this helper instead of inline `toLocaleDateString(locale === "ar" ?
 * "ar-SA" : "en-US", …)` so AR/EN parity stays consistent.
 */

export type DateLike = Date | string | number | null | undefined

const AR_LOCALE = "ar-SA"
const EN_LOCALE = "en-US"

/** Resolve our 2-letter locale to the matching BCP-47 tag. */
export function resolveDateLocale(locale: "ar" | "en" | string): string {
  return locale === "ar" ? AR_LOCALE : EN_LOCALE
}

/**
 * Format a date for display using the user's UI locale.
 * Returns an em-dash for null/undefined/invalid inputs so callers don't
 * need to guard.
 */
export function formatLocaleDate(
  date: DateLike,
  locale: "ar" | "en" | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return "—"
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(resolveDateLocale(locale), options)
}
