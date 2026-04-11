import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenHandler } from './refresh-token.handler';
import { TokenService } from '../shared/token.service';
import { PrismaService } from '../../../infrastructure/database';

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenService: any;

  const futureDate = new Date(Date.now() + 86400000);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenHandler,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: { findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
          },
        },
        { provide: TokenService, useValue: { issueTokenPair: jest.fn() } },
      ],
    }).compile();

    handler = module.get(RefreshTokenHandler);
    prisma = module.get(PrismaService);
    tokenService = module.get(TokenService);
  });

  it('issues new token pair when refresh token is valid', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      { id: 'rt-1', userId: 'user-1', tokenHash: '$2b$10$abc', expiresAt: futureDate, revokedAt: null, tenantId: 'tenant-1', createdAt: new Date() },
    ]);
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, customRole: null, isActive: true });
    prisma.refreshToken.update.mockResolvedValue({});
    tokenService.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });

    const result = await handler.execute({ tenantId: 'tenant-1', userId: 'user-1', rawToken: 'raw' });
    expect(result.accessToken).toBe('new-acc');
  });

  it('throws UnauthorizedException when no valid token found', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);
    await expect(
      handler.execute({ tenantId: 'tenant-1', userId: 'user-1', rawToken: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
