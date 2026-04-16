import * as jwt from 'jsonwebtoken';
import { testPrisma } from './db.setup';
import * as bcrypt from 'bcryptjs';

const ACCESS_SECRET = 'test-access-secret-32chars-min';

export interface TestUser {
  id: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
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
};

export const receptionistUser: TestUser = {
  id: 'user-receptionist-e2e',
  email: 'receptionist@e2e.test',
  role: 'RECEPTIONIST',
  customRoleId: null,
  permissions: [],
};

export async function ensureTestUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('Test@1234', 10);

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
}