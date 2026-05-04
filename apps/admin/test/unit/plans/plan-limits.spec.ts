import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLAN_LIMITS,
  QUOTA_FIELDS,
  OVERAGE_FIELDS,
  FEATURE_FIELDS,
  QUANT_FIELD_MAP,
  hydrateLimits,
  mergeLimits,
  type PlanLimits,
} from '../../../features/plans/plan-limits';

describe('DEFAULT_PLAN_LIMITS', () => {
  it('has all required quota fields', () => {
    expect(DEFAULT_PLAN_LIMITS.maxBranches).toBe(1);
    expect(DEFAULT_PLAN_LIMITS.maxEmployees).toBe(5);
    expect(DEFAULT_PLAN_LIMITS.maxServices).toBe(-1);
    expect(DEFAULT_PLAN_LIMITS.maxBookingsPerMonth).toBe(-1);
    expect(DEFAULT_PLAN_LIMITS.maxClients).toBe(-1);
  });

  it('has overage rates defaulting to 0', () => {
    expect(DEFAULT_PLAN_LIMITS.overageRateBookings).toBe(0);
    expect(DEFAULT_PLAN_LIMITS.overageRateClients).toBe(0);
  });

  it('has all boolean feature fields defaulting to false', () => {
    const boolKeys: Array<keyof PlanLimits> = [
      'recurring_bookings', 'waitlist', 'group_sessions', 'ai_chatbot',
      'email_templates', 'coupons', 'advanced_reports', 'intake_forms',
      'custom_roles', 'activity_log', 'zoom_integration', 'walk_in_bookings',
      'bank_transfer_payments', 'multi_branch', 'departments', 'client_ratings',
      'data_export', 'sms_provider_per_tenant', 'white_label_mobile',
      'custom_domain', 'api_access', 'webhooks', 'priority_support',
      'audit_export', 'multi_currency',
    ];
    for (const key of boolKeys) {
      expect(DEFAULT_PLAN_LIMITS[key]).toBe(false);
    }
  });

  it('has email_fallback_monthly and sms_fallback_monthly with non-zero defaults', () => {
    expect(DEFAULT_PLAN_LIMITS.email_fallback_monthly).toBe(500);
    expect(DEFAULT_PLAN_LIMITS.sms_fallback_monthly).toBe(100);
  });
});

describe('QUOTA_FIELDS', () => {
  it('contains 5 entries', () => {
    expect(QUOTA_FIELDS).toHaveLength(5);
  });

  it('all entries have key, label, hint properties', () => {
    for (const f of QUOTA_FIELDS) {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('label');
      expect(f).toHaveProperty('hint');
    }
  });

  it('contains maxBranches entry with -1 hint', () => {
    const entry = QUOTA_FIELDS.find((f) => f.key === 'maxBranches');
    expect(entry).toBeDefined();
    expect(entry!.hint).toContain('-1');
  });
});

describe('OVERAGE_FIELDS', () => {
  it('contains 2 entries for bookings and clients', () => {
    expect(OVERAGE_FIELDS).toHaveLength(2);
    const keys = OVERAGE_FIELDS.map((f) => f.key);
    expect(keys).toContain('overageRateBookings');
    expect(keys).toContain('overageRateClients');
  });
});

describe('FEATURE_FIELDS', () => {
  it('has at least 25 entries (10 Phase1 + 15 Phase3)', () => {
    expect(FEATURE_FIELDS.length).toBeGreaterThanOrEqual(25);
  });

  it('all entries have key and label', () => {
    for (const f of FEATURE_FIELDS) {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('label');
    }
  });
});

describe('QUANT_FIELD_MAP', () => {
  it('maps branches to maxBranches', () => {
    expect(QUANT_FIELD_MAP['branches']).toBe('maxBranches');
  });

  it('maps employees to maxEmployees', () => {
    expect(QUANT_FIELD_MAP['employees']).toBe('maxEmployees');
  });

  it('maps services to maxServices', () => {
    expect(QUANT_FIELD_MAP['services']).toBe('maxServices');
  });

  it('maps monthly_bookings to maxBookingsPerMonth', () => {
    expect(QUANT_FIELD_MAP['monthly_bookings']).toBe('maxBookingsPerMonth');
  });
});

describe('hydrateLimits', () => {
  it('returns DEFAULT_PLAN_LIMITS when called with undefined', () => {
    const result = hydrateLimits(undefined);
    expect(result).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it('returns DEFAULT_PLAN_LIMITS when called with empty object', () => {
    const result = hydrateLimits({});
    expect(result).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it('overrides boolean fields from raw', () => {
    const result = hydrateLimits({ recurring_bookings: true, waitlist: true });
    expect(result.recurring_bookings).toBe(true);
    expect(result.waitlist).toBe(true);
    // Other booleans stay false
    expect(result.group_sessions).toBe(false);
  });

  it('overrides numeric fields from raw', () => {
    const result = hydrateLimits({ maxBranches: 5, maxEmployees: 20 });
    expect(result.maxBranches).toBe(5);
    expect(result.maxEmployees).toBe(20);
    // Others keep defaults
    expect(result.maxServices).toBe(-1);
  });

  it('handles -1 (unlimited) value for numeric fields', () => {
    const result = hydrateLimits({ maxBranches: -1 });
    expect(result.maxBranches).toBe(-1);
  });

  it('ignores unknown keys (type mismatch — string in boolean field)', () => {
    // "recurring_bookings" expects boolean; passing string should keep default
    const result = hydrateLimits({ recurring_bookings: 'yes' as unknown as boolean });
    expect(result.recurring_bookings).toBe(false);
  });

  it('ignores unknown keys (type mismatch — string in number field)', () => {
    const result = hydrateLimits({ maxBranches: 'ten' as unknown as number });
    expect(result.maxBranches).toBe(1); // keeps default
  });

  it('warns about unknown keys and ignores them', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = hydrateLimits({ unknownFeature: true });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknownFeature'));
    expect((result as Record<string, unknown>)['unknownFeature']).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('full round-trip: hydrate from known values', () => {
    const raw: Record<string, unknown> = {
      maxBranches: 3,
      maxEmployees: 15,
      coupons: true,
      ai_chatbot: true,
    };
    const result = hydrateLimits(raw);
    expect(result.maxBranches).toBe(3);
    expect(result.maxEmployees).toBe(15);
    expect(result.coupons).toBe(true);
    expect(result.ai_chatbot).toBe(true);
    expect(result.maxServices).toBe(-1); // default preserved
  });
});

describe('mergeLimits', () => {
  it('spreads raw then edited on top', () => {
    const raw = { legacyKey: 'old', maxBranches: 1 };
    const edited: PlanLimits = { ...DEFAULT_PLAN_LIMITS, maxBranches: 10 };
    const result = mergeLimits(raw, edited);
    expect(result['maxBranches']).toBe(10);
    expect(result['legacyKey']).toBe('old');
  });

  it('works with undefined raw (treats as empty object)', () => {
    const edited: PlanLimits = { ...DEFAULT_PLAN_LIMITS, maxBranches: 7 };
    const result = mergeLimits(undefined, edited);
    expect(result['maxBranches']).toBe(7);
  });

  it('does not mutate the raw object', () => {
    const raw = { maxBranches: 1 };
    const edited: PlanLimits = { ...DEFAULT_PLAN_LIMITS, maxBranches: 99 };
    mergeLimits(raw, edited);
    expect(raw.maxBranches).toBe(1);
  });
});
