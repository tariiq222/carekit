import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthController } from './auth.controller';
import { TokenService } from '../../modules/identity/shared/token.service';

const TENANT = 'tenant-1';
const USER_ID = 'user-1';
const TOKEN_PAIR = { accessToken: 'access', refreshToken: 'refresh' };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const login = fn(TOKEN_PAIR);
  const logout = fn({ success: true });
  const prisma = {
    refreshToken: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  } as never;
  const tokens = {
    issueTokenPair: jest.fn().mockResolvedValue(TOKEN_PAIR),
  } as unknown as TokenService;
  const controller = new AuthController(login as never, logout as never, prisma, tokens);
  return { controller, login, logout, prisma, tokens };
}

describe('AuthController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loginEndpoint', () => {
    it('passes tenantId, email, and password to login handler', async () => {
      const { controller, login } = buildController();
      await controller.loginEndpoint(TENANT, { email: 'a@b.com', password: 'pass123' } as never);
      expect(login.execute).toHaveBeenCalledWith({
        tenantId: TENANT,
        email: 'a@b.com',
        password: 'pass123',
      });
    });

    it('returns token pair from login handler', async () => {
      const { controller, login } = buildController();
      const result = await controller.loginEndpoint(TENANT, { email: 'a@b.com', password: 'pass123' } as never);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('refreshEndpoint', () => {
    it('finds matching refresh token and issues new tokens', async () => {
      const rawToken = 'raw-refresh';
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const matched = { id: 'rt-1', userId: USER_ID, tenantId: TENANT, tokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
      const user = {
        id: USER_ID, email: 'a@b.com', isActive: true,
        customRole: { name: 'admin', permissions: [] },
      };

      const { controller, prisma, tokens } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([matched]);
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (tokens.issueTokenPair as jest.Mock).mockResolvedValue(TOKEN_PAIR);

      const result = await controller.refreshEndpoint({ refreshToken: rawToken } as never);

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: { tokenSelector: rawToken.slice(0, 8), revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { customRole: { include: { permissions: true } } },
      });
      expect(result).toEqual(TOKEN_PAIR);
    });

    it('throws UnauthorizedException when no token matches', async () => {
      const { controller, prisma } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([]);

      await expect(controller.refreshEndpoint({ refreshToken: 'bad' } as never))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      const rawToken = 'raw-refresh';
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const matched = { id: 'rt-1', userId: USER_ID, tenantId: TENANT, tokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };

      const { controller, prisma } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([matched]);
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(controller.refreshEndpoint({ refreshToken: rawToken } as never))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      const rawToken = 'raw-refresh';
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const matched = { id: 'rt-1', userId: USER_ID, tenantId: TENANT, tokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
      const user = { id: USER_ID, email: 'a@b.com', isActive: false };

      const { controller, prisma } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([matched]);
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(controller.refreshEndpoint({ refreshToken: rawToken } as never))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logoutEndpoint', () => {
    it('finds matching refresh token and calls logout handler', async () => {
      const rawToken = 'raw-refresh';
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const matched = { id: 'rt-1', userId: USER_ID, tenantId: TENANT, tokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };

      const { controller, logout, prisma } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([matched]);

      await controller.logoutEndpoint({ refreshToken: rawToken } as never);

      expect(logout.execute).toHaveBeenCalledWith({
        userId: USER_ID,
        tenantId: TENANT,
      });
    });

    it('throws UnauthorizedException when no token matches', async () => {
      const { controller, prisma } = buildController();
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([]);

      await expect(controller.logoutEndpoint({ refreshToken: 'bad' } as never))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
