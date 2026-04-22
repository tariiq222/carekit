import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02f §9.5 — ChatbotConfig singleton isolation
 *
 * 1. Each org gets its own ChatbotConfig row (lazy-created on first upsert-on-read).
 * 2. Updating Org A's config does not mutate Org B's.
 */
describe('SaaS-02f — chatbot-config singleton isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('each org gets its own ChatbotConfig row (not a shared singleton)', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`cbc-iso-a-${ts}`, 'منظمة بوت أ');
    const b = await h.createOrg(`cbc-iso-b-${ts}`, 'منظمة بوت ب');

    const cfgA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatbotConfig.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id, greetingAr: 'مرحبا من أ' },
      }),
    );

    const cfgB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.chatbotConfig.upsert({
        where: { organizationId: b.id },
        update: {},
        create: { organizationId: b.id, greetingAr: 'مرحبا من ب' },
      }),
    );

    expect(cfgA.id).not.toBe(cfgB.id);
    expect(cfgA.organizationId).toBe(a.id);
    expect(cfgB.organizationId).toBe(b.id);
    expect(cfgA.greetingAr).toBe('مرحبا من أ');
    expect(cfgB.greetingAr).toBe('مرحبا من ب');
  });

  it("updating org A's chatbot config does not mutate org B's", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`cbc-upd-a-${ts}`, 'منظمة بوت تحديث أ');
    const b = await h.createOrg(`cbc-upd-b-${ts}`, 'منظمة بوت تحديث ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatbotConfig.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id, systemPromptAr: 'sys-A' },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.chatbotConfig.upsert({
        where: { organizationId: b.id },
        update: {},
        create: { organizationId: b.id, systemPromptAr: 'sys-B' },
      }),
    );

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatbotConfig.update({
        where: { organizationId: a.id },
        data: { systemPromptAr: 'sys-A-updated' },
      }),
    );

    let fromB: { systemPromptAr: string | null } | null = null;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.chatbotConfig.findFirst({
        where: { organizationId: b.id },
        select: { systemPromptAr: true },
      });
    });
    expect(fromB!.systemPromptAr).toBe('sys-B');
  });
});
