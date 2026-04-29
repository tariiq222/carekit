import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ClientJwtStrategy } from './client-jwt.strategy';
import { PrismaService } from '../../infrastructure/database';
import { TenantContextService } from '../../common/tenant';

describe('ClientJwtStrategy', () => {
  let strategy: ClientJwtStrategy;
  let prisma: any;
  let tenant: { set: jest.Mock };

  beforeEach(async () => {
    tenant = { set: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ClientJwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
        { provide: PrismaService, useValue: { client: { findUnique: jest.fn() } } },
        { provide: TenantContextService, useValue: tenant },
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
    expect(tenant.set).not.toHaveBeenCalled();
  });

  it('rejects when client is missing, inactive, or soft-deleted', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' }),
    ).rejects.toThrow(UnauthorizedException);

    prisma.client.findUnique.mockResolvedValue({ id: 'c1', isActive: false, deletedAt: null });
    await expect(
      strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' }),
    ).rejects.toThrow(UnauthorizedException);

    prisma.client.findUnique.mockResolvedValue({ id: 'c1', isActive: true, deletedAt: new Date() });
    await expect(
      strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('propagates organizationId from JWT payload into req.user and tenant context', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'c1', email: 'c@x.sa', phone: null, organizationId: 'org-db', isActive: true, deletedAt: null,
    });
    const result = await strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' });
    expect(result.organizationId).toBe('org-jwt');
    expect(tenant.set).toHaveBeenCalledWith({
      organizationId: 'org-jwt',
      membershipId: '',
      id: 'c1',
      role: 'CLIENT',
      isSuperAdmin: false,
    });
  });

  it('stamps tenant context before client lookup so scoped reads have context', async () => {
    const order: string[] = [];
    tenant.set.mockImplementation(() => order.push('tenant'));
    prisma.client.findUnique.mockImplementation(async () => {
      order.push('lookup');
      return { id: 'c1', email: 'c@x.sa', phone: null, isActive: true, deletedAt: null };
    });

    await strategy.validate({} as Request, { ...payload, organizationId: 'org-jwt' });

    expect(order).toEqual(['tenant', 'lookup']);
  });

  it('rejects tokens without tenant claim before database lookup', async () => {
    await expect(strategy.validate({} as Request, payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
    expect(tenant.set).not.toHaveBeenCalled();
  });

  it('does not fall back to Client.organizationId when JWT lacks the claim', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'c1', email: 'c@x.sa', phone: null, organizationId: 'org-fallback', isActive: true, deletedAt: null,
    });
    await expect(strategy.validate({} as Request, payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });
});
