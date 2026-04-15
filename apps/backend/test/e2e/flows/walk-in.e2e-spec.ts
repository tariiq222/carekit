import { testPrisma } from '../../setup/db.setup';
import {
  setupFlowFixtures,
  teardownFlowFixtures,
  authHeaders,
  FLOW_TENANT,
  type FlowFixtures,
} from './_helpers/flow-fixtures';

describe('Flows — Walk-in Client (e2e)', () => {
  let fx: FlowFixtures;

  beforeAll(async () => {
    fx = await setupFlowFixtures();
  });

  afterAll(async () => {
    await teardownFlowFixtures();
  });

  it('[FLOW-WI-01][Flows/walk-in][P1-High] إنشاء عميل walk-in عبر API', async () => {
    const uniquePhone = `+9665${Date.now().toString().slice(-8)}`;
    const res = await fx.req
      .post('/dashboard/people/clients')
      .set(authHeaders(fx.token))
      .send({
        firstName: 'وليد',
        lastName: 'محمود',
        phone: uniquePhone,
        source: 'WALK_IN',
        accountType: 'WALK_IN',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const inDb = await (testPrisma as never as { client: { findUnique(args: unknown): Promise<{ source: string; accountType: string; tenantId: string; userId: string | null } | null> } })
      .client.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb!.source).toBe('WALK_IN');
    expect(inDb!.accountType).toBe('WALK_IN');
    expect(inDb!.tenantId).toBe(FLOW_TENANT);
    expect(inDb!.userId).toBeNull();
  });

  // TODO(backend): implement claim-account endpoint
  //   Needs: PATCH /dashboard/people/clients/:id/claim that links a walk-in client
  //   to a registered user and sets `claimedAt`. Schema field exists at
  //   apps/backend/prisma/schema/people.prisma (claimedAt). No handler/route yet.
  it.skip('[FLOW-WI-02][Flows/walk-in][P2-Medium] claim account لاحقاً (PENDING backend)', () => {
    // implement once POST /dashboard/people/clients/:id/claim lands
  });

  // TODO(backend): implement merge-clients endpoint
  //   Needs: POST /dashboard/people/clients/:id/merge that consolidates bookings,
  //   payments, and notes from source client into target. No handler exists.
  it.skip('[FLOW-WI-03][Flows/walk-in][P2-Medium] merge مع عميل موجود (PENDING backend)', () => {
    // implement once POST /dashboard/people/clients/:targetId/merge lands
  });
});
