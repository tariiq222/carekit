import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02f §9.3 — Chat (ChatConversation + CommsChatMessage + ChatSession + ChatMessage) isolation
 */
describe('SaaS-02f — chat isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('conversation + messages created in org A are invisible from org B', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`chat-iso-a-${ts}`, 'منظمة محادثة أ');
    const b = await h.createOrg(`chat-iso-b-${ts}`, 'منظمة محادثة ب');

    const conv = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatConversation.create({
        data: {
          organizationId: a.id,
          clientId: `cli-${ts}`,
          isAiChat: true,
        },
        select: { id: true },
      }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.commsChatMessage.create({
        data: {
          organizationId: a.id,
          conversationId: conv.id,
          senderType: 'CLIENT',
          body: 'hello from A',
        },
      }),
    );

    let convFromB: Awaited<ReturnType<typeof h.prisma.chatConversation.findFirst>>;
    let msgsFromB: Awaited<ReturnType<typeof h.prisma.commsChatMessage.findMany>>;
    await h.runAs({ organizationId: b.id }, async () => {
      convFromB = await h.prisma.chatConversation.findFirst({ where: { id: conv.id } });
      msgsFromB = await h.prisma.commsChatMessage.findMany({ where: { conversationId: conv.id } });
    });
    expect(convFromB!).toBeNull();
    expect(msgsFromB!).toHaveLength(0);
  });

  it('ChatSession + ChatMessage (AI cluster) are scoped per org', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`ai-sess-a-${ts}`, 'منظمة جلسة ذكاء أ');
    const b = await h.createOrg(`ai-sess-b-${ts}`, 'منظمة جلسة ذكاء ب');

    const sess = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatSession.create({
        data: { organizationId: a.id, clientId: `cli-${ts}` },
        select: { id: true },
      }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.chatMessage.create({
        data: {
          organizationId: a.id,
          sessionId: sess.id,
          role: 'user',
          content: 'secret',
        },
      }),
    );

    let sessFromB: Awaited<ReturnType<typeof h.prisma.chatSession.findFirst>>;
    let msgCountFromB = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      sessFromB = await h.prisma.chatSession.findFirst({ where: { id: sess.id } });
      msgCountFromB = await h.prisma.chatMessage.count({ where: { sessionId: sess.id } });
    });
    expect(sessFromB!).toBeNull();
    expect(msgCountFromB).toBe(0);
  });
});
