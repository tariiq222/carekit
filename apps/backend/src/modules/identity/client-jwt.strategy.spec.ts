import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ClientJwtStrategy } from './client-jwt.strategy';
import { PrismaService } from '../../infrastructure/database';

describe('ClientJwtStrategy', () => {
  let strategy: ClientJwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClientJwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
        { provide: PrismaService, useValue: { client: { findUnique: jest.fn() } } },
      ],
    }).compile();

    strategy = module.get(ClientJwtStrategy);
    prisma = module.get(PrismaService);
  });

  const payload = { sub: 'c1', email: 'c@x.sa', namespace: 'client' as const, jti: 'j1' };

  it('rejects tokens without client namespace', async () => {
    await expect(
      strategy.validate({} as Request, { ...payload, namespace: 'user' as unknown as 'client' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when client is missing, inactive, or soft-deleted', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(strategy.validate({} as Request, payload)).rejects.toThrow(UnauthorizedException);

    prisma.client.findUnique.mockResolvedValue({ id: 'c1', isActive: false, deletedAt: null });
    await expect(strategy.validate({} as Request, payload)).rejects.toThrow(UnauthorizedException);

    prisma.client.findUnique.mockResolvedValue({ id: 'c1', isActive: true, deletedAt: new Date() });
    await expect(strategy.validate({} as Request, payload)).rejects.toThrow(UnauthorizedException);
  });

  it('propagates organizationId from JWT payload into req.user', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'c1', email: 'c@x.sa', phone: null, organizationId: 'org-db', isActive: true, deletedAt: null,
    });
    const result = await strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' });
    expect(result.organizationId).toBe('org-jwt');
  });

  it('falls back to Client.organizationId when JWT lacks the claim', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'c1', email: 'c@x.sa', phone: null, organizationId: 'org-fallback', isActive: true, deletedAt: null,
    });
    const result = await strategy.validate({} as Request, payload);
    expect(result.organizationId).toBe('org-fallback');
  });
});
