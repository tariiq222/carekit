import { describe, it, expect } from 'vitest';
import { formatCurrency, formatSar } from '@/lib/currency';

describe('formatSar / formatCurrency', () => {
  it('formats SAR with 2 decimals and locale grouping', () => {
    expect(formatSar(1234.5)).toBe('SAR 1,234.50');
  });

  it('formats other currencies with the same shape', () => {
    expect(formatCurrency(1000, 'USD')).toBe('USD 1,000.00');
  });

  it('handles zero', () => {
    expect(formatSar(0)).toBe('SAR 0.00');
  });

  it('handles negative', () => {
    expect(formatSar(-5)).toBe('SAR -5.00');
  });

  it('handles string numbers', () => {
    expect(formatSar('99.5')).toBe('SAR 99.50');
  });

  it('handles null / undefined gracefully', () => {
    expect(formatSar(null)).toBe('SAR 0.00');
    expect(formatSar(undefined)).toBe('SAR 0.00');
  });

  it('handles NaN gracefully', () => {
    expect(formatSar('not a number')).toBe('SAR 0.00');
  });
});
