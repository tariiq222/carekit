/**
 * CareKit — CaslAbilityFactory Unit Tests (TDD RED Phase)
 *
 * Tests the CASL ability factory that generates permission sets
 * for each role, per the Permission Matrix in docs/api-spec.md.
 *
 * The factory must:
 *   - Generate all 52 permissions for super_admin
 *   - Generate correct subset for each default role
 *   - Handle ownership conditions (practitioner: own, patient: own)
 *   - Handle custom roles with arbitrary permission combinations
 *   - Handle users with multiple roles (union of permissions)
 *
 * These tests will FAIL until backend-dev implements CaslAbilityFactory.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CaslAbilityFactory } from '../casl-ability.factory.js';

type Action = 'view' | 'create' | 'edit' | 'delete';

interface UserWithRoles {
  id: string;
  roles: Array<{
    slug: string;
    permissions: Array<{
      module: string;
      action: Action;
    }>;
  }>;
}

interface AppAbility {
  can(action: Action, subject: string): boolean;
  cannot(action: Action, subject: string): boolean;
}

// ---------------------------------------------------------------------------
// Permission Matrix (from api-spec.md)
// ---------------------------------------------------------------------------

const ALL_MODULES = [
  'users',
  'roles',
  'practitioners',
  'bookings',
  'services',
  'payments',
  'invoices',
  'reports',
  'notifications',
  'chatbot',
  'whitelabel',
  'patients',
  'ratings',
] as const;

const ALL_ACTIONS: Action[] = ['view', 'create', 'edit', 'delete'];

/** Expected permissions for each default role (from api-spec.md matrix) */
const ROLE_PERMISSIONS: Record<
  string,
  Array<{ module: string; action: Action }>
> = {
  super_admin: ALL_MODULES.flatMap((module) =>
    ALL_ACTIONS.map((action) => ({ module, action })),
  ), // All 52

  receptionist: [
    { module: 'practitioners', action: 'view' },
    { module: 'practitioners', action: 'create' },
    { module: 'practitioners', action: 'edit' },
    { module: 'bookings', action: 'view' },
    { module: 'bookings', action: 'create' },
    { module: 'bookings', action: 'edit' },
    { module: 'services', action: 'view' },
    { module: 'services', action: 'create' },
    { module: 'services', action: 'edit' },
    { module: 'payments', action: 'view' },
    { module: 'invoices', action: 'view' },
    { module: 'notifications', action: 'view' },
    { module: 'notifications', action: 'create' },
    { module: 'notifications', action: 'edit' },
    { module: 'patients', action: 'view' },
    { module: 'patients', action: 'create' },
    { module: 'patients', action: 'edit' },
  ],

  accountant: [
    { module: 'bookings', action: 'view' },
    { module: 'payments', action: 'view' },
    { module: 'payments', action: 'create' },
    { module: 'payments', action: 'edit' },
    { module: 'invoices', action: 'view' },
    { module: 'invoices', action: 'create' },
    { module: 'invoices', action: 'edit' },
    { module: 'reports', action: 'view' },
    { module: 'reports', action: 'create' },
    { module: 'reports', action: 'edit' },
  ],

  // practitioner and patient have "own" conditions —
  // tested separately in ownership tests
  practitioner: [
    { module: 'practitioners', action: 'view' }, // own
    { module: 'practitioners', action: 'edit' }, // own
    { module: 'bookings', action: 'view' }, // own
    { module: 'patients', action: 'view' }, // own
    { module: 'ratings', action: 'view' }, // own
  ],

  patient: [
    { module: 'practitioners', action: 'view' },
    { module: 'bookings', action: 'view' }, // own
    { module: 'bookings', action: 'create' },
    { module: 'services', action: 'view' },
    { module: 'payments', action: 'view' }, // own
    { module: 'invoices', action: 'view' }, // own
    { module: 'ratings', action: 'view' },
    { module: 'ratings', action: 'create' },
    { module: 'ratings', action: 'edit' }, // own
  ],
};

/** Permissions that a role should explicitly NOT have */
const ROLE_FORBIDDEN: Record<
  string,
  Array<{ module: string; action: Action }>
> = {
  receptionist: [
    { module: 'users', action: 'view' },
    { module: 'users', action: 'create' },
    { module: 'users', action: 'edit' },
    { module: 'users', action: 'delete' },
    { module: 'roles', action: 'view' },
    { module: 'whitelabel', action: 'view' },
    { module: 'whitelabel', action: 'edit' },
    { module: 'reports', action: 'view' },
    { module: 'chatbot', action: 'view' },
    { module: 'services', action: 'delete' },
    { module: 'practitioners', action: 'delete' },
    { module: 'bookings', action: 'delete' },
    { module: 'payments', action: 'delete' },
    { module: 'patients', action: 'delete' },
  ],

  accountant: [
    { module: 'users', action: 'view' },
    { module: 'users', action: 'edit' },
    { module: 'bookings', action: 'create' },
    { module: 'bookings', action: 'edit' },
    { module: 'practitioners', action: 'view' },
    { module: 'services', action: 'view' },
    { module: 'whitelabel', action: 'view' },
    { module: 'chatbot', action: 'view' },
    { module: 'notifications', action: 'view' },
  ],

  patient: [
    { module: 'users', action: 'view' },
    { module: 'users', action: 'create' },
    { module: 'users', action: 'edit' },
    { module: 'users', action: 'delete' },
    { module: 'roles', action: 'view' },
    { module: 'whitelabel', action: 'view' },
    { module: 'whitelabel', action: 'edit' },
    { module: 'reports', action: 'view' },
    { module: 'chatbot', action: 'view' }, // chatbot admin — patient uses /chatbot/message, not admin
    { module: 'services', action: 'create' },
    { module: 'services', action: 'edit' },
    { module: 'services', action: 'delete' },
    { module: 'practitioners', action: 'edit' },
    { module: 'practitioners', action: 'delete' },
    { module: 'bookings', action: 'delete' },
    { module: 'ratings', action: 'delete' },
  ],
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaslAbilityFactory],
    }).compile();

    factory = module.get<CaslAbilityFactory>(CaslAbilityFactory);
  });

  // =========================================================================
  // super_admin
  // =========================================================================

  it('should generate all 52 permissions for super_admin', () => {
    const user: UserWithRoles = {
      id: 'admin-id',
      roles: [
        {
          slug: 'super_admin',
          permissions: ROLE_PERMISSIONS.super_admin,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // super_admin can do EVERYTHING
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(ability.can(action, module)).toBe(true);
      }
    }

    // Count: should have all 52
    let permissionCount = 0;
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        if (ability.can(action, module)) permissionCount++;
      }
    }
    expect(permissionCount).toBe(52);
  });

  // =========================================================================
  // receptionist
  // =========================================================================

  it('should generate correct permissions for receptionist', () => {
    const user: UserWithRoles = {
      id: 'receptionist-id',
      roles: [
        {
          slug: 'receptionist',
          permissions: ROLE_PERMISSIONS.receptionist,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Allowed permissions
    for (const perm of ROLE_PERMISSIONS.receptionist) {
      expect(ability.can(perm.action, perm.module)).toBe(true);
    }

    // Forbidden permissions
    for (const perm of ROLE_FORBIDDEN.receptionist) {
      expect(ability.cannot(perm.action, perm.module)).toBe(true);
    }
  });

  // =========================================================================
  // accountant
  // =========================================================================

  it('should generate correct permissions for accountant', () => {
    const user: UserWithRoles = {
      id: 'accountant-id',
      roles: [
        {
          slug: 'accountant',
          permissions: ROLE_PERMISSIONS.accountant,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Allowed permissions
    for (const perm of ROLE_PERMISSIONS.accountant) {
      expect(ability.can(perm.action, perm.module)).toBe(true);
    }

    // Forbidden permissions
    for (const perm of ROLE_FORBIDDEN.accountant) {
      expect(ability.cannot(perm.action, perm.module)).toBe(true);
    }
  });

  // =========================================================================
  // practitioner (with ownership conditions)
  // =========================================================================

  it('should generate correct permissions for practitioner (with ownership)', () => {
    const practitionerId = 'practitioner-user-id';
    const user: UserWithRoles = {
      id: practitionerId,
      roles: [
        {
          slug: 'practitioner',
          permissions: ROLE_PERMISSIONS.practitioner,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Should be able to view practitioners (at least own)
    expect(ability.can('view', 'practitioners')).toBe(true);

    // Should NOT be able to create practitioners
    expect(ability.cannot('create', 'practitioners')).toBe(true);

    // Should NOT be able to delete practitioners
    expect(ability.cannot('delete', 'practitioners')).toBe(true);

    // Should NOT access users, roles, whitelabel, chatbot admin
    expect(ability.cannot('view', 'users')).toBe(true);
    expect(ability.cannot('view', 'roles')).toBe(true);
    expect(ability.cannot('view', 'whitelabel')).toBe(true);
    expect(ability.cannot('view', 'payments')).toBe(true);
    expect(ability.cannot('create', 'bookings')).toBe(true);
  });

  // =========================================================================
  // patient (with ownership conditions)
  // =========================================================================

  it('should generate correct permissions for patient (with ownership)', () => {
    const user: UserWithRoles = {
      id: 'patient-user-id',
      roles: [
        {
          slug: 'patient',
          permissions: ROLE_PERMISSIONS.patient,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Allowed
    for (const perm of ROLE_PERMISSIONS.patient) {
      expect(ability.can(perm.action, perm.module)).toBe(true);
    }

    // Forbidden
    for (const perm of ROLE_FORBIDDEN.patient) {
      expect(ability.cannot(perm.action, perm.module)).toBe(true);
    }
  });

  // =========================================================================
  // Multiple roles (union of permissions)
  // =========================================================================

  it('should handle user with multiple roles (union of permissions)', () => {
    // A user with both receptionist and accountant roles
    const user: UserWithRoles = {
      id: 'multi-role-id',
      roles: [
        {
          slug: 'receptionist',
          permissions: ROLE_PERMISSIONS.receptionist,
        },
        {
          slug: 'accountant',
          permissions: ROLE_PERMISSIONS.accountant,
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Should have union of both role permissions

    // From receptionist
    expect(ability.can('view', 'practitioners')).toBe(true);
    expect(ability.can('create', 'bookings')).toBe(true);
    expect(ability.can('view', 'patients')).toBe(true);
    expect(ability.can('view', 'notifications')).toBe(true);

    // From accountant
    expect(ability.can('view', 'reports')).toBe(true);
    expect(ability.can('create', 'payments')).toBe(true);
    expect(ability.can('edit', 'invoices')).toBe(true);

    // Neither role has these
    expect(ability.cannot('view', 'users')).toBe(true);
    expect(ability.cannot('view', 'whitelabel')).toBe(true);
    expect(ability.cannot('view', 'roles')).toBe(true);
  });

  // =========================================================================
  // Custom role
  // =========================================================================

  it('should handle custom role with specific permissions', () => {
    const user: UserWithRoles = {
      id: 'custom-role-user',
      roles: [
        {
          slug: 'assistant_manager',
          permissions: [
            { module: 'bookings', action: 'view' },
            { module: 'bookings', action: 'create' },
            { module: 'patients', action: 'view' },
          ],
        },
      ],
    };

    const ability = factory.createForUser(user);

    // Permitted
    expect(ability.can('view', 'bookings')).toBe(true);
    expect(ability.can('create', 'bookings')).toBe(true);
    expect(ability.can('view', 'patients')).toBe(true);

    // Not permitted
    expect(ability.cannot('edit', 'bookings')).toBe(true);
    expect(ability.cannot('delete', 'bookings')).toBe(true);
    expect(ability.cannot('view', 'payments')).toBe(true);
    expect(ability.cannot('view', 'users')).toBe(true);
    expect(ability.cannot('view', 'whitelabel')).toBe(true);
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('should handle user with no roles (deny everything)', () => {
    const user: UserWithRoles = {
      id: 'no-role-user',
      roles: [],
    };

    const ability = factory.createForUser(user);

    // Should deny all actions on all modules
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(ability.cannot(action, module)).toBe(true);
      }
    }
  });

  it('should handle role with empty permissions array', () => {
    const user: UserWithRoles = {
      id: 'empty-perms-user',
      roles: [
        {
          slug: 'empty_role',
          permissions: [],
        },
      ],
    };

    const ability = factory.createForUser(user);

    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(ability.cannot(action, module)).toBe(true);
      }
    }
  });
});
