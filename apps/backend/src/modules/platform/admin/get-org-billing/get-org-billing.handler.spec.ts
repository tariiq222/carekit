import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetOrgBillingHandler } from './get-org-billing.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('GetOrgBillingHandler', () => {
  let handler: GetOrgBillingHandler;
  let orgFind: jest.Mock;
  let subFind: jest.Mock;
  let invFindMany: jest.Mock;
  let usageFindMany: jest.Mock;
  let creditFindMany: jest.Mock;

  beforeEach(async () => {
    orgFind = jest.fn();
    subFind = jest.fn();
    invFindMany = jest.fn();
    usageFindMany = jest.fn();
    creditFindMany = jest.fn();
    const prismaMock = {
      $allTenants: {
        organization: { findUnique: orgFind },
        subscription: { findUnique: subFind },
        subscriptionInvoice: { findMany: invFindMany },
        usageRecord: { findMany: usageFindMany },
      },
      billingCredit: { findMany: creditFindMany },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetOrgBillingHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(GetOrgBillingHandler);
  });

  it('throws when org missing', async () => {
    orgFind.mockResolvedValue(null);

    await expect(handler.execute({ organizationId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns org + subscription + last 12 invoices + current-period usage + credits', async () => {
    orgFind.mockResolvedValue({ id: 'o1', slug: 's', nameAr: 'A', nameEn: 'A' });
    subFind.mockResolvedValue({
      id: 'sub1',
      currentPeriodStart: new Date('2026-04-01'),
      plan: { slug: 'PRO' },
    });
    invFindMany.mockResolvedValue([{ id: 'i1' }]);
    usageFindMany.mockResolvedValue([{ metric: 'BOOKINGS_PER_MONTH', count: 50 }]);
    creditFindMany.mockResolvedValue([{ id: 'c1', amount: '50' }]);

    const result = await handler.execute({ organizationId: 'o1' });

    expect(result.org.id).toBe('o1');
    expect(result.subscription?.id).toBe('sub1');
    expect(result.invoices).toHaveLength(1);
    expect(result.usage).toHaveLength(1);
    expect(result.credits).toHaveLength(1);
    expect(invFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 12, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('returns null subscription + empty invoices/usage when org has no sub', async () => {
    orgFind.mockResolvedValue({ id: 'o1', slug: 's' });
    subFind.mockResolvedValue(null);
    creditFindMany.mockResolvedValue([]);

    const result = await handler.execute({ organizationId: 'o1' });

    expect(result.subscription).toBeNull();
    expect(result.invoices).toEqual([]);
    expect(result.usage).toEqual([]);
    expect(invFindMany).not.toHaveBeenCalled();
    expect(usageFindMany).not.toHaveBeenCalled();
  });
});
