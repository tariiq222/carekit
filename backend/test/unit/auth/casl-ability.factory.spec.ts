/**
 * CaslAbilityFactory — Unit Tests
 * Covers: super_admin full permissions, patient limited permissions, can/cannot checks
 */
import { CaslAbilityFactory } from '../../../src/modules/auth/casl-ability.factory.js';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  // ── super_admin — full permissions ───────────────────────────

  it('should grant all permissions for super_admin role', () => {
    const superAdmin = {
      id: 'admin-1',
      roles: [
        {
          slug: 'super_admin',
          permissions: [
            { module: 'bookings', action: 'view' as const },
            { module: 'bookings', action: 'create' as const },
            { module: 'bookings', action: 'edit' as const },
            { module: 'bookings', action: 'delete' as const },
            { module: 'patients', action: 'view' as const },
            { module: 'patients', action: 'create' as const },
            { module: 'patients', action: 'edit' as const },
            { module: 'patients', action: 'delete' as const },
            { module: 'users', action: 'view' as const },
            { module: 'users', action: 'create' as const },
            { module: 'users', action: 'edit' as const },
            { module: 'users', action: 'delete' as const },
            { module: 'payments', action: 'view' as const },
            { module: 'payments', action: 'create' as const },
            { module: 'payments', action: 'edit' as const },
            { module: 'payments', action: 'delete' as const },
            { module: 'invoices', action: 'view' as const },
            { module: 'invoices', action: 'create' as const },
            { module: 'invoices', action: 'edit' as const },
            { module: 'invoices', action: 'delete' as const },
            { module: 'roles', action: 'view' as const },
            { module: 'roles', action: 'create' as const },
            { module: 'roles', action: 'edit' as const },
            { module: 'roles', action: 'delete' as const },
            { module: 'clinic', action: 'view' as const },
            { module: 'clinic', action: 'edit' as const },
          ],
        },
      ],
    };

    const ability = factory.createForUser(superAdmin);

    expect(ability.can('view', 'bookings')).toBe(true);
    expect(ability.can('create', 'bookings')).toBe(true);
    expect(ability.can('edit', 'bookings')).toBe(true);
    expect(ability.can('delete', 'bookings')).toBe(true);
    expect(ability.can('view', 'patients')).toBe(true);
    expect(ability.can('delete', 'patients')).toBe(true);
    expect(ability.can('edit', 'roles')).toBe(true);
    expect(ability.can('edit', 'clinic')).toBe(true);
  });

  // ── patient — limited permissions ────────────────────────────

  it('should grant only view + create for patient role', () => {
    const patient = {
      id: 'patient-1',
      roles: [
        {
          slug: 'patient',
          permissions: [
            { module: 'bookings', action: 'view' as const },
            { module: 'bookings', action: 'create' as const },
            { module: 'patients', action: 'view' as const },
            { module: 'patients', action: 'edit' as const },
            { module: 'payments', action: 'view' as const },
            { module: 'payments', action: 'create' as const },
            { module: 'invoices', action: 'view' as const },
          ],
        },
      ],
    };

    const ability = factory.createForUser(patient);

    // Allowed
    expect(ability.can('view', 'bookings')).toBe(true);
    expect(ability.can('create', 'bookings')).toBe(true);
    expect(ability.can('view', 'patients')).toBe(true);
    expect(ability.can('edit', 'patients')).toBe(true);
    expect(ability.can('view', 'payments')).toBe(true);
    expect(ability.can('create', 'payments')).toBe(true);
    expect(ability.can('view', 'invoices')).toBe(true);

    // Denied
    expect(ability.can('delete', 'bookings')).toBe(false);
    expect(ability.can('edit', 'bookings')).toBe(false);
    expect(ability.can('delete', 'patients')).toBe(false);
    expect(ability.can('create', 'invoices')).toBe(false);
    expect(ability.can('edit', 'roles')).toBe(false);
    expect(ability.can('view', 'roles')).toBe(false);
  });

  // ── can/cannot checks ───────────────────────────────────────

  it('should return false for actions the user cannot perform', () => {
    const user = {
      id: 'user-1',
      roles: [
        {
          slug: 'receptionist',
          permissions: [
            { module: 'bookings', action: 'view' as const },
            { module: 'bookings', action: 'create' as const },
          ],
        },
      ],
    };

    const ability = factory.createForUser(user);

    expect(ability.can('view', 'bookings')).toBe(true);
    expect(ability.can('delete', 'bookings')).toBe(false);
    expect(ability.can('view', 'payments')).toBe(false);
  });

  // ── Multiple roles (union) ──────────────────────────────────

  it('should union permissions from multiple roles', () => {
    const multiRoleUser = {
      id: 'user-multi',
      roles: [
        {
          slug: 'receptionist',
          permissions: [
            { module: 'bookings', action: 'view' as const },
            { module: 'bookings', action: 'create' as const },
          ],
        },
        {
          slug: 'practitioner',
          permissions: [
            { module: 'patients', action: 'view' as const },
            { module: 'patients', action: 'edit' as const },
            { module: 'bookings', action: 'edit' as const },
          ],
        },
      ],
    };

    const ability = factory.createForUser(multiRoleUser);

    // From receptionist
    expect(ability.can('view', 'bookings')).toBe(true);
    expect(ability.can('create', 'bookings')).toBe(true);
    // From practitioner
    expect(ability.can('view', 'patients')).toBe(true);
    expect(ability.can('edit', 'patients')).toBe(true);
    expect(ability.can('edit', 'bookings')).toBe(true);
  });

  // ── No roles ────────────────────────────────────────────────

  it('should grant no permissions when user has no roles', () => {
    const user = {
      id: 'no-roles-user',
      roles: [],
    };

    const ability = factory.createForUser(user);

    expect(ability.can('view', 'bookings')).toBe(false);
    expect(ability.can('create', 'patients')).toBe(false);
    expect(ability.can('delete', 'users')).toBe(false);
  });

  it('should grant no permissions when role has no permissions array', () => {
    const user = {
      id: 'empty-role-user',
      roles: [
        {
          slug: 'custom_role',
          permissions: [],
        },
      ],
    };

    const ability = factory.createForUser(user);

    expect(ability.can('view', 'bookings')).toBe(false);
  });
});
