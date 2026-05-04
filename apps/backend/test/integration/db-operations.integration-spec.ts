import { testPrisma, cleanTables } from '../setup/db.setup';
import { seedUser } from '../setup/seed.helper';

describe('DB Operations (integration)', () => {
  beforeEach(async () => {
    await cleanTables(['RefreshToken', 'User', 'Membership', 'Organization']);
  });

  afterEach(async () => {
    await cleanTables(['RefreshToken', 'User', 'Membership', 'Organization']);
  });

  describe('User CRUD', () => {
    it('creates a user and retrieves it', async () => {
      const user = await seedUser(testPrisma, {
        email: 'db-test@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      const found = await testPrisma.user.findUnique({ where: { id: user.id } });

      expect(found).not.toBeNull();
      expect(found!.email).toBe('db-test@clinic.com');
    });

    it('links user to organization via Membership', async () => {
      const org = await testPrisma.organization.create({
        data: {
          id: '00000000-0000-0000-0000-000000000099',
          slug: 'db-test-org',
          nameAr: 'اختبار',
          nameEn: 'Test Org',
          status: 'ACTIVE',
        },
      });

      const user = await seedUser(testPrisma, {
        email: 'member-test@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      const membership = await testPrisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'ADMIN',
          isActive: true,
        },
      });

      const found = await testPrisma.membership.findUnique({
        where: { id: membership.id },
        include: { user: true, organization: true },
      });

      expect(found!.user.email).toBe('member-test@clinic.com');
      expect(found!.organization.slug).toBe('db-test-org');
    });

    it('cascades deletion of related records', async () => {
      const user = await seedUser(testPrisma, {
        email: 'cascade-test@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      await testPrisma.user.delete({ where: { id: user.id } });

      const countAfter = await testPrisma.refreshToken.count({ where: { userId: user.id } });
      expect(countAfter).toBe(0);
    });
  });

  describe('Transaction support', () => {
    it('executes operations in a transaction', async () => {
      const user1 = await seedUser(testPrisma, { email: 'tx1@clinic.com', role: 'ADMIN' });
      const user2 = await seedUser(testPrisma, { email: 'tx2@clinic.com', role: 'ADMIN' });

      const result = await testPrisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user1.id }, data: { name: 'Updated One' } });
        await tx.user.update({ where: { id: user2.id }, data: { name: 'Updated Two' } });
        return true;
      });

      expect(result).toBe(true);

      const u1 = await testPrisma.user.findUnique({ where: { id: user1.id } });
      const u2 = await testPrisma.user.findUnique({ where: { id: user2.id } });

      expect(u1!.name).toBe('Updated One');
      expect(u2!.name).toBe('Updated Two');
    });
  });
});