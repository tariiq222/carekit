/**
 * Centralized currency formatting for admin app surfaces. Avoids 10+ ad-hoc
 * `Number(value).toLocaleString()` callsites that drift over time.
 *
 * Examples:
 *   formatSar(1234.5) → "SAR 1,234.50"
 *   formatCurrency(1000, 'USD') → "USD 1,000.00"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'SAR',
): string {
  if (amount === null || amount === undefined || amount === '') return `${currency} 0.00`;
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSar(amount: number | string | null | undefined): string {
  return formatCurrency(amount, 'SAR');
}
