import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

const makeCtx = (user: object | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('SuperAdminGuard', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const guard = new SuperAdminGuard(prisma as never);

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it('returns true for a super-admin user re-verified from the database', async () => {
    prisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });

    await expect(guard.canActivate(makeCtx({ sub: 'u-super', isSuperAdmin: true }))).resolves.toBe(true);
  });

  it('rejects a regular user', async () => {
    await expect(guard.canActivate(makeCtx({ sub: 'u-regular', isSuperAdmin: false }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects an expired or missing authenticated request', async () => {
    await expect(guard.canActivate(makeCtx(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the JWT still claims super-admin but the database flag was revoked', async () => {
    prisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });

    await expect(guard.canActivate(makeCtx({ sub: 'u-super', isSuperAdmin: true }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
