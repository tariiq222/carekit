import * as jwt from 'jsonwebtoken';
import { testPrisma } from './db.setup';
import * as bcrypt from 'bcryptjs';

const ACCESS_SECRET = 'test-access-secret-32chars-min';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export interface TestUser {
  id: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
  organizationId?: string;
}

export function createTestToken(user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions: user.permissions,
      features: [],
      // Include organizationId so FeatureGuard and PlanLimitsGuard can read
      // the tenant context without throwing UnauthorizedException.
      organizationId: user.organizationId ?? DEFAULT_ORG_ID,
      membershipRole: user.role,
    },
    ACCESS_SECRET,
    { expiresIn: '1h' },
  );
}

export const adminUser: TestUser = {
  id: 'user-admin-e2e',
  email: 'admin@e2e.test',
  role: 'ADMIN',
  customRoleId: null,
  permissions: [],
  organizationId: DEFAULT_ORG_ID,
};

export const receptionistUser: TestUser = {
  id: 'user-receptionist-e2e',
  email: 'receptionist@e2e.test',
  role: 'RECEPTIONIST',
  customRoleId: null,
  permissions: [],
  organizationId: DEFAULT_ORG_ID,
};

/**
 * The default Organization referenced by `DEFAULT_ORGANIZATION_ID` is seeded
 * by migration `20260421112047_saas01_organization_membership`. Some test
 * suites TRUNCATE Organization (directly or via CASCADE) and don't restore
 * it, leaving the next test run with a missing FK target. This upsert is
 * idempotent and called from `createTestApp()` so every test app boot
 * starts from a known good state.
 */
export async function ensureDefaultOrganization(): Promise<void> {
  await testPrisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'default',
      nameAr: 'Default',
      nameEn: 'Default',
      status: 'ACTIVE',
    },
  });
}

export async function ensureTestUsers(): Promise<void> {
  await ensureDefaultOrganization();

  const passwordHash = await bcrypt.hash('Test@1234', 10);
  const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

  await testPrisma.user.upsert({
    where: { email: 'admin@e2e.test' },
    update: {},
    create: {
      id: adminUser.id,
      email: 'admin@e2e.test',
      name: 'Admin E2E',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Every non-CLIENT user must have at least one active Membership in the
  // default org — asserted by the foundation isolation test. Create it here
  // so the invariant holds from the moment the test user row exists.
  await testPrisma.membership.upsert({
    where: { userId_organizationId: { userId: adminUser.id, organizationId: DEFAULT_ORG_ID } },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: DEFAULT_ORG_ID,
      role: 'ADMIN',
      isActive: true,
    },
  });
}