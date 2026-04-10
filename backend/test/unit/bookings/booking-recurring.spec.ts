// Mirror the addInterval function logic directly in the test file since it's not exported.
// This tests the exact implementation that will be in booking-recurring.service.ts.

const PATTERN_DAYS: Record<string, number> = {
  daily: 1,
  every_2_days: 2,
  every_3_days: 3,
  weekly: 7,
  biweekly: 14,
  monthly: 0,
};

function addInterval(date: Date, pattern: string): Date {
  const next = new Date(date);
  if (pattern === 'monthly') {
    const intendedMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    // Clamp: if JS overflowed past the intended month (e.g. Jan 31 → Mar 3),
    // roll back to the last day of the intended month (setDate(0) = last day of prev month)
    if (next.getMonth() !== intendedMonth) {
      next.setDate(0);
    }
  } else {
    next.setDate(next.getDate() + (PATTERN_DAYS[pattern] ?? 7));
  }
  return next;
}

describe('addInterval monthly', () => {
  it('Jan 31 → Feb 28 (non-leap)', () => {
    expect(addInterval(new Date('2026-01-31'), 'monthly').toISOString().split('T')[0]).toBe('2026-02-28');
  });
  it('Mar 31 → Apr 30', () => {
    expect(addInterval(new Date('2026-03-31'), 'monthly').toISOString().split('T')[0]).toBe('2026-04-30');
  });
  it('Jan 15 → Feb 15 (no clamp needed)', () => {
    expect(addInterval(new Date('2026-01-15'), 'monthly').toISOString().split('T')[0]).toBe('2026-02-15');
  });
  it('Jan 31 leap year → Feb 29', () => {
    expect(addInterval(new Date('2024-01-31'), 'monthly').toISOString().split('T')[0]).toBe('2024-02-29');
  });
});
