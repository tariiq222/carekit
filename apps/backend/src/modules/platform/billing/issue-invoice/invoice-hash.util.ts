import { createHash } from 'node:crypto';

/**
 * Phase 7 — invoice hash chain input.
 *
 * The hash chain provides chronological integrity for the per-organization
 * invoice ledger. Each invoice's hash covers its own canonical billing
 * fields plus the prior issued invoice's hash, so any tampering with an
 * earlier row is detectable at the next.
 */
export interface InvoiceHashInput {
  invoiceNumber: string;
  organizationId: string;
  /** VAT-inclusive total, fixed-2 string (e.g. "115.00"). */
  amount: string;
  currency: string;
  /** ISO-8601 UTC timestamp. */
  issuedAt: string;
  /** ISO-8601 UTC timestamp. */
  periodStart: string;
  /** ISO-8601 UTC timestamp. */
  periodEnd: string;
  /** Hex digest of the previous invoice, or "0" for the first issued invoice. */
  previousHash: string;
}

/**
 * Deterministic JSON canonicalization: keys sorted alphabetically at every
 * object level, no insignificant whitespace. Matches the rule documented in
 * the Phase 7 plan so `computeInvoiceHash` is order-independent over input
 * key insertion order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') +
    '}'
  );
}

export function computeInvoiceHash(input: InvoiceHashInput): string {
  return createHash('sha256').update(canonicalize(input), 'utf8').digest('hex');
}
