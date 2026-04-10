/**
 * Regression tests for HIGH fix #5:
 * service.minLeadMinutes and service.maxAdvanceDays were dead fields.
 * booking-creation.service.ts only enforced clinic-level constraints.
 *
 * Also covers HIGH fix #25: SetServiceBranchesDto ArrayMinSize(1) removed
 * so empty branchIds [] is valid (makes service global).
 */

import { validate } from 'class-validator';
import { SetServiceBranchesDto } from '../../../src/modules/services/dto/set-service-branches.dto.js';

// ── SetServiceBranchesDto (fix #25) ─────────────────────────────────────────

describe('SetServiceBranchesDto — allow empty branchIds (fix #25)', () => {
  it('REGRESSION: accepts empty array [] to make service global', async () => {
    const dto = new SetServiceBranchesDto();
    dto.branchIds = [];

    const errors = await validate(dto);
    expect(errors).toHaveLength(0); // must pass — empty = global
  });

  it('accepts array with valid UUID branch IDs', async () => {
    const dto = new SetServiceBranchesDto();
    dto.branchIds = ['550e8400-e29b-41d4-a716-446655440000'];

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-UUID values', async () => {
    const dto = new SetServiceBranchesDto();
    dto.branchIds = ['not-a-uuid'];

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-array value', async () => {
    const dto = Object.assign(new SetServiceBranchesDto(), { branchIds: 'not-an-array' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Constraint resolution logic (fix #5) ────────────────────────────────────
// Unit-testing the constraint math directly without spinning up the full service

describe('Service-level booking constraint resolution logic (fix #5)', () => {
  // Helper that mirrors the effectiveMaxDays logic in booking-creation.service.ts
  function resolveMaxDays(clinicMax: number, serviceMax: number | null): number {
    const effectiveMaxDays = (serviceMax != null && serviceMax > 0)
      ? (clinicMax > 0 ? Math.min(clinicMax, serviceMax) : serviceMax)
      : clinicMax;
    return effectiveMaxDays;
  }

  // Helper that mirrors effectiveLeadMinutes logic
  function resolveLeadMinutes(clinicLead: number, serviceLead: number | null): number {
    return Math.max(clinicLead ?? 0, serviceLead ?? 0);
  }

  it('REGRESSION: service.maxAdvanceDays=7 overrides clinic maxAdvanceDays=30', () => {
    // Clinic allows 30 days advance, service restricts to 7
    expect(resolveMaxDays(30, 7)).toBe(7);
  });

  it('clinic maxAdvanceDays applies when service has no restriction (null)', () => {
    expect(resolveMaxDays(30, null)).toBe(30);
  });

  it('service maxAdvanceDays applies when clinic has no restriction (0)', () => {
    expect(resolveMaxDays(0, 14)).toBe(14);
  });

  it('takes minimum when both clinic and service have restrictions', () => {
    expect(resolveMaxDays(30, 7)).toBe(7);
    expect(resolveMaxDays(7, 30)).toBe(7); // clinic is stricter
  });

  it('no restriction when both are 0/null', () => {
    expect(resolveMaxDays(0, null)).toBe(0);
    expect(resolveMaxDays(0, 0)).toBe(0);
  });

  it('REGRESSION: service.minLeadMinutes=120 overrides clinic minLead=60', () => {
    // Service requires 2h notice, clinic requires 1h → 2h applies
    expect(resolveLeadMinutes(60, 120)).toBe(120);
  });

  it('clinic lead applies when service has no restriction', () => {
    expect(resolveLeadMinutes(60, null)).toBe(60);
    expect(resolveLeadMinutes(60, 0)).toBe(60);
  });

  it('service lead applies when clinic has no restriction', () => {
    expect(resolveLeadMinutes(0, 90)).toBe(90);
  });

  it('no lead restriction when both are 0', () => {
    expect(resolveLeadMinutes(0, 0)).toBe(0);
  });
});
