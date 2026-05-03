import { addMonthsUtc, advanceBillingPeriodEnd } from './billing-period.util';

describe('billing-period.util', () => {
  describe('addMonthsUtc', () => {
    it('adds 1 month within the same year', () => {
      const out = addMonthsUtc(new Date('2026-03-15T12:00:00.000Z'), 1);
      expect(out.toISOString()).toBe('2026-04-15T12:00:00.000Z');
    });

    it('rolls over the year boundary', () => {
      const out = addMonthsUtc(new Date('2026-12-15T00:00:00.000Z'), 1);
      expect(out.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('clamps Jan 31 + 1 month to last day of February (non-leap)', () => {
      const out = addMonthsUtc(new Date('2026-01-31T00:00:00.000Z'), 1);
      expect(out.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });

    it('clamps Jan 31 + 1 month to Feb 29 in a leap year', () => {
      const out = addMonthsUtc(new Date('2028-01-31T00:00:00.000Z'), 1);
      expect(out.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    });

    it('adds 12 months for ANNUAL', () => {
      const out = addMonthsUtc(new Date('2026-06-15T00:00:00.000Z'), 12);
      expect(out.toISOString()).toBe('2027-06-15T00:00:00.000Z');
    });
  });

  describe('advanceBillingPeriodEnd', () => {
    it('advances from currentPeriodEnd when it is in the future', () => {
      const periodEnd = new Date('2030-06-15T00:00:00.000Z');
      const now = new Date('2026-05-03T00:00:00.000Z');
      const out = advanceBillingPeriodEnd(periodEnd, 'MONTHLY', now);
      expect(out.toISOString()).toBe('2030-07-15T00:00:00.000Z');
    });

    it('advances from now when currentPeriodEnd is in the past', () => {
      const stalePeriodEnd = new Date('2025-01-01T00:00:00.000Z');
      const now = new Date('2026-05-03T00:00:00.000Z');
      const out = advanceBillingPeriodEnd(stalePeriodEnd, 'MONTHLY', now);
      expect(out.toISOString()).toBe('2026-06-03T00:00:00.000Z');
    });

    it('advances by 12 months for ANNUAL cycle', () => {
      const periodEnd = new Date('2030-06-15T00:00:00.000Z');
      const now = new Date('2026-05-03T00:00:00.000Z');
      const out = advanceBillingPeriodEnd(periodEnd, 'ANNUAL', now);
      expect(out.toISOString()).toBe('2031-06-15T00:00:00.000Z');
    });
  });
});
