/**
 * P2.C — Audit append-only enforcement.
 *
 * Verifies that even with deqah_rls_probe's privileges, the runtime cannot
 * UPDATE or DELETE audit rows. Only privileged migrations running as the
 * OWNER with the explicit override GUC can.
 *
 * The probe connects via `h.rlsProbeUrl()` — a `deqah_rls_probe` DSN that
 * carries NOBYPASSRLS and is NOT a member of the `deqah` owner role. The
 * trigger rejects any UPDATE/DELETE unless both conditions are met:
 *   (a) app.audit_admin_override = 'on'
 *   (b) current_user is a member of the `deqah` owner role
 * Neither condition is satisfiable by the probe, so every mutation attempt
 * must fail with ERRCODE=insufficient_privilege.
 */
import { Client } from 'pg';
import { bootSecurityHarness, SecurityHarness } from './harness';

describe('Audit append-only — 2026-05-10', () => {
  let h: SecurityHarness;

  beforeAll(async () => {
    h = await bootSecurityHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  /** Open a fresh pg.Client connected as the NOBYPASSRLS probe role. */
  const probe = async (): Promise<Client> => {
    const client = new Client({ connectionString: h.rlsProbeUrl() });
    await client.connect();
    return client;
  };

  it('runtime probe cannot DELETE from ActivityLog', async () => {
    // Seed an ActivityLog row under a real org via the app.
    const { orgA } = await h.seedTwoOrgs('audit-aol-del');
    await h.withCls(orgA.id, async () => {
      await h.prisma.activityLog.create({
        data: {
          organizationId: orgA.id,
          action: 'SYSTEM',
          entity: 'TEST',
          description: 'P2.C append-only delete probe',
        },
      });
    });

    const client = await probe();
    try {
      await client.query(`SET app.current_org_id = '${orgA.id}'`);
      await expect(
        client.query(
          `DELETE FROM "ActivityLog" WHERE "organizationId" = '${orgA.id}'::uuid`,
        ),
      ).rejects.toThrow(/append_only_violation|insufficient_privilege/i);
    } finally {
      await client.end();
    }
  });

  it('runtime probe cannot UPDATE ActivityLog', async () => {
    const { orgA } = await h.seedTwoOrgs('audit-aol-upd');
    await h.withCls(orgA.id, async () => {
      await h.prisma.activityLog.create({
        data: {
          organizationId: orgA.id,
          action: 'SYSTEM',
          entity: 'TEST',
          description: 'P2.C append-only update probe',
        },
      });
    });

    const client = await probe();
    try {
      await client.query(`SET app.current_org_id = '${orgA.id}'`);
      await expect(
        client.query(
          `UPDATE "ActivityLog" SET action = 'EVIL' WHERE "organizationId" = '${orgA.id}'::uuid`,
        ),
      ).rejects.toThrow(/append_only_violation|insufficient_privilege/i);
    } finally {
      await client.end();
    }
  });
});
