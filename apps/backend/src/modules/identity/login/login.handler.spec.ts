import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { PasswordService } from '../shared/password.service';
import { TokenService } from '../shared/token.service';
import { PrismaService } from '../../../infrastructure/database';

const mockUser = {
  id: 'user-1',
  email: 'admin@clinic.sa',
  passwordHash: '$2b$10$hashed',
  name: 'Admin',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'ADMIN',
  customRoleId: null,
  customRole: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  failedLoginAttempts: 0,
  lockedUntil: null,
};

describe('LoginHandler', () => {
  let handler: LoginHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LoginHandler,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
            membership: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
          } as unknown as PrismaService,
        },
        { provide: PasswordService, useValue: { verify: jest.fn() } },
        {
          provide: TokenService,
          useValue: {
            issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' }),
          },
        },
      ],
    }).compile();

    handler = module.get(LoginHandler);
    prisma = module.get(PrismaService);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  it('returns token pair for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser as never);
    passwordService.verify.mockResolvedValue(true);
    tokenService.issueTokenPair.mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' });

    const result = await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });
    expect(result.accessToken).toBe('acc');
    expect(result.refreshToken).toBe('ref');
  });

  it('throws UnauthorizedException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ email: 'x@y.com', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password wrong', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser as never);
    passwordService.verify.mockResolvedValue(false);
    await expect(
      handler.execute({ email: 'admin@clinic.sa', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false } as never);
    passwordService.verify.mockResolvedValue(true);
    await expect(
      handler.execute({ email: 'admin@clinic.sa', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects users with null passwordHash (mobile-only accounts)', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: null } as never);
    await expect(
      handler.execute({ email: 'a@b.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('SaaS-01 tenant claims', () => {
    it('passes the active membership to TokenService.issueTokenPair', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastActiveOrganizationId: null } as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findMany.mockResolvedValue([{
        id: 'mem-1',
        organizationId: '00000000-0000-0000-0000-000000000001',
        role: 'ADMIN',
      }]);

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        expect.objectContaining({
          organizationId: '00000000-0000-0000-0000-000000000001',
          membershipId: 'mem-1',
          membershipRole: 'ADMIN',
          isSuperAdmin: false,
        }),
      );
    });

    it('falls back to DEFAULT_ORGANIZATION_ID when user has no membership row', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastActiveOrganizationId: null } as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findMany.mockResolvedValue([]);

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          organizationId: '00000000-0000-0000-0000-000000000001',
          membershipId: undefined,
        }),
      );
    });

    it('marks isSuperAdmin true when user.isSuperAdmin is true', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isSuperAdmin: true, lastActiveOrganizationId: null } as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findMany.mockResolvedValue([]);

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ isSuperAdmin: true }),
      );
    });
  });

  describe('per-account login lockout', () => {
    it('rejects login when account is locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: futureDate,
        failedLoginAttempts: 0,
      } as never);

      await expect(
        handler.execute({ email: 'admin@clinic.sa', password: 'correct' }),
      ).rejects.toThrow(new UnauthorizedException('Account locked. Try again later.'));

      // Must NOT call password.verify — short-circuits before bcrypt
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('increments failedLoginAttempts on bad password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 2,
      } as never);
      passwordService.verify.mockResolvedValue(false);

      await expect(
        handler.execute({ email: 'admin@clinic.sa', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
    });

    it('locks account after 5 failed attempts and resets counter', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4,
      } as never);
      passwordService.verify.mockResolvedValue(false);

      await expect(
        handler.execute({ email: 'admin@clinic.sa', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      // Counter resets to 0 and lockedUntil is set
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('resets failedLoginAttempts and lockedUntil on successful login', async () => {
      const pastDate = new Date(Date.now() - 1000); // expired lock
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 3,
        lockedUntil: pastDate,
      } as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findMany.mockResolvedValue([]);

      await handler.execute({ email: 'admin@clinic.sa', password: 'correct' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
    });
  });
});
