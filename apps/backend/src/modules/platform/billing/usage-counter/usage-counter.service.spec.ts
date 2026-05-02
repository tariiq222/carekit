import { UsageCounterService } from './usage-counter.service';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EPOCH } from './period.util';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const ORG_ID = 'org-test-123';

function makePrisma() {
  const store = new Map<string, number>();

  const key = (orgId: string, fk: string, ps: Date) =>
    `${orgId}::${fk}::${ps.toISOString()}`;

  const mockCounter = {
    upsert: jest.fn(async ({ where, update, create }: {
      where: { organizationId_featureKey_periodStart: { organizationId: string; featureKey: string; periodStart: Date } };
      update: { value: { increment: number } | number };
      create: { organizationId: string; featureKey: string; periodStart: Date; value: number };
    }) => {
      const k = key(
        where.organizationId_featureKey_periodStart.organizationId,
        where.organizationId_featureKey_periodStart.featureKey,
        where.organizationId_featureKey_periodStart.periodStart,
      );
      const existing = store.get(k);
      if (existing !== undefined) {
        const upd = update as Record<string, unknown>;
        const val = upd['value'];
        if (val !== null && typeof val === 'object' && 'increment' in (val as object)) {
          store.set(k, existing + (val as { increment: number }).increment);
        } else {
          store.set(k, val as number);
        }
      } else {
        store.set(k, create.value);
      }
    }),
    findUnique: jest.fn(async ({ where }: {
      where: { organizationId_featureKey_periodStart: { organizationId: string; featureKey: string; periodStart: Date } };
    }) => {
      const k = key(
        where.organizationId_featureKey_periodStart.organizationId,
        where.organizationId_featureKey_periodStart.featureKey,
        where.organizationId_featureKey_periodStart.periodStart,
      );
      const v = store.get(k);
      return v !== undefined ? { value: v } : null;
    }),
  };

  return {
    usageCounter: mockCounter,
    _store: store,
    _key: key,
  } as unknown as PrismaService & { _store: Map<string, number>; _key: typeof key };
}

describe('UsageCounterService', () => {
  it('increments from 0 → 1, then 1 → 3 (by 2)', async () => {
    const prisma = makePrisma();
    const svc = new UsageCounterService(prisma);

    await svc.increment(ORG_ID, FeatureKey.EMPLOYEES, EPOCH, 1);
    expect(await svc.read(ORG_ID, FeatureKey.EMPLOYEES, EPOCH)).toBe(1);

    await svc.increment(ORG_ID, FeatureKey.EMPLOYEES, EPOCH, 2);
    expect(await svc.read(ORG_ID, FeatureKey.EMPLOYEES, EPOCH)).toBe(3);
  });

  it('returns null for a non-existent counter', async () => {
    const prisma = makePrisma();
    const svc = new UsageCounterService(prisma);

    const result = await svc.read(ORG_ID, FeatureKey.BRANCHES, EPOCH);
    expect(result).toBeNull();
  });

  it('upsertExact overwrites the current value', async () => {
    const prisma = makePrisma();
    const svc = new UsageCounterService(prisma);

    await svc.increment(ORG_ID, FeatureKey.SERVICES, EPOCH, 5);
    await svc.upsertExact(ORG_ID, FeatureKey.SERVICES, EPOCH, 10);
    expect(await svc.read(ORG_ID, FeatureKey.SERVICES, EPOCH)).toBe(10);
  });
});
