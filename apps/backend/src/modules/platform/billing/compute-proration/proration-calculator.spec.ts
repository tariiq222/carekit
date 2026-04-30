import { computeProrationAmountSar } from './proration-calculator';

const periodStart = new Date('2026-04-01T00:00:00.000Z');
const periodEnd = new Date('2026-05-01T00:00:00.000Z');

describe('computeProrationAmountSar', () => {
  it('charges nearly the full positive monthly difference on day 1 of a 30-day period', () => {
    const result = computeProrationAmountSar({
      currentPriceSar: '300.00',
      targetPriceSar: '900.00',
      periodStart,
      periodEnd,
      now: new Date('2026-04-02T00:00:00.000Z'),
    });

    expect(result.isUpgrade).toBe(true);
    expect(result.remainingRatio).toBeCloseTo(29 / 30, 6);
    expect(result.amountSar).toBe('580.00');
    expect(result.amountHalalas).toBe(58000);
  });

  it('charges only the remaining-period difference on day 29', () => {
    const result = computeProrationAmountSar({
      currentPriceSar: '300.00',
      targetPriceSar: '900.00',
      periodStart,
      periodEnd,
      now: new Date('2026-04-30T00:00:00.000Z'),
    });

    expect(result.remainingRatio).toBeCloseTo(1 / 30, 6);
    expect(result.amountSar).toBe('20.00');
    expect(result.amountHalalas).toBe(2000);
  });

  it('clamps expired periods to zero', () => {
    const result = computeProrationAmountSar({
      currentPriceSar: '300.00',
      targetPriceSar: '900.00',
      periodStart,
      periodEnd,
      now: new Date('2026-05-02T00:00:00.000Z'),
    });

    expect(result.remainingRatio).toBe(0);
    expect(result.amountSar).toBe('0.00');
    expect(result.amountHalalas).toBe(0);
  });

  it('returns zero and isUpgrade false for equal or lower target price', () => {
    const downgrade = computeProrationAmountSar({
      currentPriceSar: '900.00',
      targetPriceSar: '300.00',
      periodStart,
      periodEnd,
      now: new Date('2026-04-15T00:00:00.000Z'),
    });
    const equal = computeProrationAmountSar({
      currentPriceSar: '300.00',
      targetPriceSar: '300.00',
      periodStart,
      periodEnd,
      now: new Date('2026-04-15T00:00:00.000Z'),
    });

    expect(downgrade.isUpgrade).toBe(false);
    expect(downgrade.amountHalalas).toBe(0);
    expect(equal.isUpgrade).toBe(false);
    expect(equal.amountHalalas).toBe(0);
  });

  it('uses annual target price when the requested billing cycle is annual', () => {
    const result = computeProrationAmountSar({
      currentPriceSar: '300.00',
      targetPriceSar: '9000.00',
      periodStart,
      periodEnd,
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.amountSar).toBe('4350.00');
    expect(result.amountHalalas).toBe(435000);
  });
});
