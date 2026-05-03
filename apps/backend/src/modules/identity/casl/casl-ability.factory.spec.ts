import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('grants manage all for SUPER_ADMIN', () => {
    const ability = factory.buildForUser({ role: 'SUPER_ADMIN', customRole: null });
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('grants specific permissions from custom role', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'create', subject: 'Booking' }, { action: 'read', subject: 'Client' }] },
    });
    expect(ability.can('create', 'Booking')).toBe(true);
    expect(ability.can('read', 'Client')).toBe(true);
    expect(ability.can('delete', 'Booking')).toBe(false);
  });

  it('grants read on own domain for EMPLOYEE', () => {
    const ability = factory.buildForUser({ role: 'EMPLOYEE', customRole: null });
    expect(ability.can('read', 'Booking')).toBe(true);
    expect(ability.can('delete', 'Invoice')).toBe(false);
  });

  it('grants full finance access for ACCOUNTANT', () => {
    const ability = factory.buildForUser({ role: 'ACCOUNTANT', customRole: null });
    expect(ability.can('manage', 'Invoice')).toBe(true);
    expect(ability.can('manage', 'Payment')).toBe(true);
  });

  it('grants OWNER full tenant-scoped permissions plus Billing/Plan/Subscription', () => {
    const ability = factory.buildForUser({ membershipRole: 'OWNER', customRole: null });
    // Everything ADMIN gets:
    expect(ability.can('manage', 'User')).toBe(true);
    expect(ability.can('manage', 'Booking')).toBe(true);
    expect(ability.can('manage', 'Setting')).toBe(true);
    expect(ability.can('manage', 'Branding')).toBe(true);
    // Plus the OWNER-only trio:
    expect(ability.can('manage', 'Billing')).toBe(true);
    expect(ability.can('manage', 'Plan')).toBe(true);
    expect(ability.can('manage', 'Subscription')).toBe(true);
    // OWNER does NOT get platform-wide 'manage all' — that's SUPER_ADMIN only.
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('denies ADMIN access to Billing, Plan, and Subscription (OWNER-only)', () => {
    const ability = factory.buildForUser({ membershipRole: 'ADMIN', customRole: null });
    // ADMIN keeps day-to-day clinic ops:
    expect(ability.can('manage', 'User')).toBe(true);
    expect(ability.can('manage', 'Setting')).toBe(true);
    expect(ability.can('manage', 'Branding')).toBe(true);
    // ADMIN explicitly LOSES the OWNER-only subjects:
    expect(ability.can('manage', 'Billing')).toBe(false);
    expect(ability.can('read', 'Billing')).toBe(false);
    expect(ability.can('manage', 'Plan')).toBe(false);
    expect(ability.can('read', 'Plan')).toBe(false);
    expect(ability.can('manage', 'Subscription')).toBe(false);
    expect(ability.can('read', 'Subscription')).toBe(false);
  });

  // ── Bug B5: canonical role is Membership.role (membershipRole), not User.role ──

  it('prefers membershipRole over legacy role when both are present', () => {
    // Legacy global role says ADMIN (full access). Per-org role says
    // RECEPTIONIST. The factory MUST use the per-org role.
    const ability = factory.buildForUser({
      membershipRole: 'RECEPTIONIST',
      role: 'ADMIN',
      customRole: null,
    });
    expect(ability.can('manage', 'Booking')).toBe(true); // RECEPTIONIST keeps booking
    expect(ability.can('manage', 'User')).toBe(false); // RECEPTIONIST cannot manage users
    expect(ability.can('manage', 'Setting')).toBe(false); // ADMIN-only — must be denied
  });

  it('demotes a legacy-OWNER user when their membership is RECEPTIONIST', () => {
    const ability = factory.buildForUser({
      membershipRole: 'RECEPTIONIST',
      role: 'OWNER',
      customRole: null,
    });
    expect(ability.can('manage', 'Branding')).toBe(false);
    expect(ability.can('manage', 'User')).toBe(false);
  });

  it('falls back to legacy role only when membershipRole is absent', () => {
    const ability = factory.buildForUser({
      membershipRole: undefined,
      role: 'ADMIN',
      customRole: null,
    });
    expect(ability.can('manage', 'User')).toBe(true);
  });

  it('null membershipRole still triggers the legacy-role fallback', () => {
    const ability = factory.buildForUser({
      membershipRole: null,
      role: 'ADMIN',
      customRole: null,
    });
    expect(ability.can('manage', 'User')).toBe(true);
  });

  it('grants no built-in abilities when neither membershipRole nor role is set', () => {
    const ability = factory.buildForUser({ customRole: null });
    expect(ability.can('read', 'Booking')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('custom role wins over membershipRole/role (custom role overrides built-ins)', () => {
    const ability = factory.buildForUser({
      membershipRole: 'OWNER',
      role: 'OWNER',
      customRole: { permissions: [{ action: 'read', subject: 'Booking' }] },
    });
    expect(ability.can('read', 'Booking')).toBe(true);
    // Custom role has no User permission, so OWNER's `manage User` must NOT leak through.
    expect(ability.can('manage', 'User')).toBe(false);
  });
});
