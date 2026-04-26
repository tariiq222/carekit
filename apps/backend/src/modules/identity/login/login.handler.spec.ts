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
            user: { findUnique: jest.fn() },
            membership: { findFirst: jest.fn().mockResolvedValue(null) },
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
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findFirst.mockResolvedValue({
        id: 'mem-1',
        organizationId: '00000000-0000-0000-0000-000000000001',
      });

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        {
          organizationId: '00000000-0000-0000-0000-000000000001',
          membershipId: 'mem-1',
          isSuperAdmin: false,
        },
      );
    });

    it('falls back to DEFAULT_ORGANIZATION_ID when user has no membership row', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findFirst.mockResolvedValue(null);

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          organizationId: '00000000-0000-0000-0000-000000000001',
          membershipId: undefined,
        }),
      );
    });

    it('marks isSuperAdmin true when user.role is SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'SUPER_ADMIN' } as never);
      passwordService.verify.mockResolvedValue(true);
      prisma.membership.findFirst.mockResolvedValue(null);

      await handler.execute({ email: 'admin@clinic.sa', password: 'secret' });

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ isSuperAdmin: true }),
      );
    });
  });
});
