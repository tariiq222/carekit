const AR_LOCALE = 'ar-SA';
const EN_LOCALE = 'en-GB';

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * Format an ISO date string as a short date in the given locale.
 * Returns '—' for null/undefined/invalid input.
 */
export function formatAdminDate(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(
    locale === 'ar' ? AR_LOCALE : EN_LOCALE,
    SHORT_DATE_OPTIONS,
  );
}

/**
 * Format an ISO date string as a locale-neutral date+time string (en-GB).
 * Returns '—' for null/undefined/invalid input.
 */
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(EN_LOCALE);
}
