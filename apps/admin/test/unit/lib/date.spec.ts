import { describe, it, expect } from 'vitest';
import { formatAdminDate, formatAdminDateTime } from '@/lib/date';

describe('formatAdminDate', () => {
  const ISO = '2026-01-15T10:00:00.000Z';

  it('returns — for null', () => {
    expect(formatAdminDate(null, 'en')).toBe('—');
  });
  it('returns — for undefined', () => {
    expect(formatAdminDate(undefined, 'en')).toBe('—');
  });
  it('returns — for invalid date string', () => {
    expect(formatAdminDate('not-a-date', 'en')).toBe('—');
  });
  it('formats in en-GB for non-ar locale', () => {
    const result = formatAdminDate(ISO, 'en');
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2026/);
  });
  it('formats in ar-SA for ar locale', () => {
    const result = formatAdminDate(ISO, 'ar');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });
});

describe('formatAdminDateTime', () => {
  it('returns — for null', () => {
    expect(formatAdminDateTime(null)).toBe('—');
  });
  it('returns — for undefined', () => {
    expect(formatAdminDateTime(undefined)).toBe('—');
  });
  it('returns — for invalid date', () => {
    expect(formatAdminDateTime('bad')).toBe('—');
  });
  it('returns a non-empty string for valid ISO', () => {
    const result = formatAdminDateTime('2026-01-15T10:30:00.000Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
    expect(result).toMatch(/2026/);
  });
});
