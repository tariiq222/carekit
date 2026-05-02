import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SuperAdminActionType } from '@prisma/client';
import { UpsertFeatureFlagOverrideHandler } from './upsert-feature-flag-override.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { EventBusService } from '../../../../infrastructure/events/event-bus.service';
import { SUBSCRIPTION_UPDATED_EVENT } from '../../billing/events/subscription-updated.event';

const ORG_ID = 'org-123';
const ADMIN_ID = 'admin-456';
const KEY = 'coupons';
const REASON = 'Pilot customer requires coupons on Basic plan';

const platformFlag = {
  allowedPlans: [],
  limitKind: null,
  nameAr: 'كوبونات',
  nameEn: 'Coupons',
  descriptionAr: null,
  descriptionEn: null,
};

function buildMocks() {
  const orgFindUnique = jest.fn().mockResolvedValue({ id: ORG_ID, subscriptionId: 'sub-1' });
  const flagFindFirst = jest.fn().mockResolvedValue(platformFlag);
  const flagUpsert = jest.fn().mockResolvedValue({ id: 'flag-1', organizationId: ORG_ID, key: KEY });
  const flagDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });

  const txClient = {
    featureFlag: { findFirst: flagFindFirst, upsert: flagUpsert, deleteMany: flagDeleteMany },
    superAdminActionLog: { create: auditCreate },
  };
  const transaction = jest.fn((cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient));

  const prismaMock = {
    $allTenants: {
      organization: { findUnique: orgFindUnique },
      $transaction: transaction,
    },
  } as unknown as PrismaService;

  const eventBusPublish = jest.fn().mockResolvedValue(undefined);
  const eventBusMock = { publish: eventBusPublish } as unknown as EventBusService;

  return { prismaMock, eventBusMock, orgFindUnique, flagFindFirst, flagUpsert, flagDeleteMany, auditCreate, eventBusPublish };
}

async function buildHandler(mocks: ReturnType<typeof buildMocks>) {
  const module = await Test.createTestingModule({
    providers: [
      UpsertFeatureFlagOverrideHandler,
      { provide: PrismaService, useValue: mocks.prismaMock },
      { provide: EventBusService, useValue: mocks.eventBusMock },
    ],
  }).compile();
  return module.get(UpsertFeatureFlagOverrideHandler);
}

describe('UpsertFeatureFlagOverrideHandler', () => {
  it('INHERIT: deletes the org-scoped override row (no upsert)', async () => {
    const mocks = buildMocks();
    const handler = await buildHandler(mocks);

    const result = await handler.execute({ organizationId: ORG_ID, key: KEY, mode: 'INHERIT', reason: REASON, superAdminUserId: ADMIN_ID });

    expect(result).toEqual({ success: true });
    expect(mocks.flagDeleteMany).toHaveBeenCalledWith({ where: { organizationId: ORG_ID, key: KEY } });
    expect(mocks.flagUpsert).not.toHaveBeenCalled();
  });

  it('FORCE_ON: upserts feature flag with enabled=true', async () => {
    const mocks = buildMocks();
    const handler = await buildHandler(mocks);

    await handler.execute({ organizationId: ORG_ID, key: KEY, mode: 'FORCE_ON', reason: REASON, superAdminUserId: ADMIN_ID });

    expect(mocks.flagUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_key: { organizationId: ORG_ID, key: KEY } },
      create: expect.objectContaining({ organizationId: ORG_ID, key: KEY, enabled: true }),
      update: { enabled: true },
    }));
    expect(mocks.flagDeleteMany).not.toHaveBeenCalled();
  });

  it('FORCE_OFF: upserts feature flag with enabled=false', async () => {
    const mocks = buildMocks();
    const handler = await buildHandler(mocks);

    await handler.execute({ organizationId: ORG_ID, key: KEY, mode: 'FORCE_OFF', reason: REASON, superAdminUserId: ADMIN_ID });

    expect(mocks.flagUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ enabled: false }),
      update: { enabled: false },
    }));
  });

  it('writes SuperAdminActionLog with correct payload, reason, and mode', async () => {
    const mocks = buildMocks();
    const handler = await buildHandler(mocks);

    await handler.execute({ organizationId: ORG_ID, key: KEY, mode: 'FORCE_ON', reason: REASON, superAdminUserId: ADMIN_ID });

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        superAdminUserId: ADMIN_ID,
        actionType: SuperAdminActionType.FEATURE_FLAG_UPDATE,
        organizationId: ORG_ID,
        reason: REASON,
        metadata: { key: KEY, mode: 'FORCE_ON' },
      }),
    });
  });

  it('emits SUBSCRIPTION_UPDATED_EVENT after transaction to trigger cache invalidation', async () => {
    const mocks = buildMocks();
    const handler = await buildHandler(mocks);

    await handler.execute({ organizationId: ORG_ID, key: KEY, mode: 'FORCE_ON', reason: REASON, superAdminUserId: ADMIN_ID });

    expect(mocks.eventBusPublish).toHaveBeenCalledWith(
      SUBSCRIPTION_UPDATED_EVENT,
      expect.objectContaining({ organizationId: ORG_ID }),
    );
  });

  it('throws NotFoundException when organization does not exist', async () => {
    const mocks = buildMocks();
    mocks.orgFindUnique.mockResolvedValue(null);
    const handler = await buildHandler(mocks);

    await expect(handler.execute({ organizationId: 'bad-id', key: KEY, mode: 'FORCE_ON', reason: REASON, superAdminUserId: ADMIN_ID }))
      .rejects.toThrow(NotFoundException);
  });
});
