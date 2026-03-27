/**
 * AuthService — OTP Tests
 * Covers: generateOtp, verifyOtp
 */
import { createAuthTestModule, AuthTestContext } from './auth.test-module.js';

describe('AuthService — generateOtp', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should create 6-digit numeric code', async () => {
    ctx.mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    ctx.mockPrisma.otpCode.create.mockImplementation(
      ({ data }: { data: { code: string } }) => {
        expect(data.code).toMatch(/^\d{6}$/);
        return Promise.resolve({ id: 'otp-id', ...data });
      },
    );

    const code = await ctx.service.generateOtp('user-id', 'login');

    expect(code).toMatch(/^\d{6}$/);
  });

  it('should set 10-minute expiry', async () => {
    ctx.mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    ctx.mockPrisma.otpCode.create.mockImplementation(
      ({ data }: { data: { expiresAt: Date } }) => {
        const diffMinutes = (new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60);
        expect(diffMinutes).toBeGreaterThan(9);
        expect(diffMinutes).toBeLessThanOrEqual(11);
        return Promise.resolve({ id: 'otp-id', ...data });
      },
    );

    await ctx.service.generateOtp('user-id', 'login');
  });

  it('should invalidate previous unused OTPs for same user and type', async () => {
    ctx.mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    ctx.mockPrisma.otpCode.create.mockResolvedValue({ id: 'otp-id', code: '123456' });

    await ctx.service.generateOtp('user-id', 'login');

    expect(ctx.mockPrisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-id', type: 'login', usedAt: null }),
      }),
    );
  });
});

describe('AuthService — verifyOtp', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should mark OTP as used after successful verification', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      gender: null,
      isActive: true,
      emailVerified: false,
      createdAt: new Date(),
      userRoles: [],
    };
    ctx.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    ctx.mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    ctx.mockPrisma.user.update.mockResolvedValue({ ...mockUser, emailVerified: true });

    await ctx.service.verifyOtp('user@example.com', '123456', 'login');

    expect(ctx.mockPrisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-id',
          code: '123456',
          usedAt: null,
        }),
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
  });

  it.each([
    ['expired OTP'],
    ['used OTP'],
    ['wrong code'],
  ])('should reject %s', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'user@example.com' });
    ctx.mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    ctx.mockPrisma.otpCode.findFirst.mockResolvedValue(null);

    await expect(
      ctx.service.verifyOtp('user@example.com', '123456', 'login'),
    ).rejects.toThrow();
  });
});
