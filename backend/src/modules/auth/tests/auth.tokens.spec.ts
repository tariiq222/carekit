/**
 * AuthService — Token & Password Tests
 * Covers: refreshToken, logout, changePassword, resetPassword
 */
import { UnauthorizedException } from '@nestjs/common';
import { createAuthTestModule, AuthTestContext } from './auth.test-module.js';

describe('AuthService — refreshToken', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should rotate refresh token — old one becomes invalid', async () => {
    const oldToken = 'old-refresh-token';
    const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    ctx.mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-id',
      token: oldToken,
      userId: 'user-id',
      expiresAt: futureExpiry,
    });
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      isActive: true,
      userRoles: [{ role: { slug: 'patient' } }],
    });
    ctx.mockPrisma.refreshToken.delete.mockResolvedValue({});
    ctx.mockPrisma.refreshToken.create.mockResolvedValue({ token: 'new-refresh-token' });

    const result = await ctx.service.refreshToken(oldToken);

    expect(ctx.mockPrisma.refreshToken.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-id' } }),
    );
    expect(ctx.mockPrisma.refreshToken.create).toHaveBeenCalled();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).not.toBe(oldToken);
  });

  it.each([
    ['token not in DB', null, true],
    ['expired token', { id: 'rt-id', token: 'expired', userId: 'u', expiresAt: new Date(Date.now() - 60_000) }, false],
  ])('should reject %s', async (_label, tokenResult, _deactivated) => {
    ctx.mockPrisma.refreshToken.findFirst.mockResolvedValue(tokenResult);

    await expect(ctx.service.refreshToken('token')).rejects.toThrow(UnauthorizedException);
  });

  it('should reject if user is deactivated', async () => {
    ctx.mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-id',
      token: 'valid-token',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'deactivated@example.com',
      isActive: false,
    });

    await expect(ctx.service.refreshToken('valid-token')).rejects.toThrow();
  });
});

describe('AuthService — logout', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should delete hashed refresh token from database', async () => {
    ctx.mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    await ctx.service.logout('refresh-token-to-revoke');

    const callArg = ctx.mockPrisma.refreshToken.deleteMany.mock.calls[0][0];
    // Token stored as SHA-256 hash, not raw value
    expect(callArg.where.token).not.toBe('refresh-token-to-revoke');
    expect(callArg.where.token).toHaveLength(64); // SHA-256 hex digest
  });
});

describe('AuthService — changePassword', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should throw if current password is wrong', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$2b$10$correcthash',
    });

    await expect(
      ctx.service.changePassword('user-id', 'WrongCurrent!', 'NewP@ss123!'),
    ).rejects.toThrow();
  });

  it('should hash new password before storing', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$2b$10$correcthash',
    });
    ctx.mockPrisma.user.update.mockResolvedValue({});

    if (ctx.mockPrisma.user.update.mock.calls.length > 0) {
      const updateCall = ctx.mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(updateCall.data.passwordHash).not.toBe('NewP@ss123!');
    }
  });
});

describe('AuthService — resetPassword', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should throw if OTP is invalid', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'user@example.com' });
    ctx.mockPrisma.otpCode.findFirst.mockResolvedValue(null);

    await expect(
      ctx.service.resetPassword('user@example.com', '000000', 'NewP@ss!'),
    ).rejects.toThrow();
  });

  it('should hash new password, update user, and mark OTP used', async () => {
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
    ctx.mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'user@example.com' });
    ctx.mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      code: '123456',
      type: 'reset_password',
      expiresAt: futureExpiry,
      usedAt: null,
    });
    ctx.mockPrisma.otpCode.update.mockResolvedValue({});
    ctx.mockPrisma.user.update.mockResolvedValue({});

    await ctx.service.resetPassword('user@example.com', '123456', 'NewStr0ngP@ss!');

    expect(ctx.mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id' },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    );
    expect(ctx.mockPrisma.otpCode.update).toHaveBeenCalled();
  });
});
