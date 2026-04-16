import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser } from '../../setup/auth.helper';
describe('AI Chatbot chat endpoint (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['ChatMessage', 'ChatSession']);
  });

  afterAll(async () => {
    await cleanTables(['ChatMessage', 'ChatSession']);
    await closeTestApp();
  });

  it('[AI-001][AI Chatbot/chat-completion][P1-High] إرسال رسالة للـ chatbot وتلقي رد', async () => {
    const res = await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'ما ساعات عمل العيادة؟' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.reply).toMatch(/test reply for:/);
    expect(res.body.sourcesUsed).toBe(0);
  });

  it('[AI-002][AI Chatbot/chat-completion][P1-High] رسالة واحدة تحفظ user+assistant في DB', async () => {
    const res = await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'سؤال' });

    expect(res.status).toBe(200);
    const sessionId = res.body.sessionId;

    const messages = await (testPrisma as any).chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('سؤال');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toMatch(/test reply for:/);
  });

  it('[AI-003][AI Chatbot/chat-completion][P2-Medium] New conversation بدون sessionId يبدأ جلسة جديدة', async () => {
    const first = await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'أول رسالة' });

    const second = await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'محادثة ثانية مستقلة' });

    expect(first.body.sessionId).not.toBe(second.body.sessionId);

    const sessions = await (testPrisma as any).chatSession.count({ where: { } });
    expect(sessions).toBe(2);
  });

  it('[AI-004][AI Chatbot/chat-completion][P2-Medium] Conversation history — نفس sessionId يراكم الرسائل', async () => {
    const first = await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'الرسالة الأولى' });

    const sessionId = first.body.sessionId;

    await req
      .post('/dashboard/ai/chat')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'الرسالة الثانية', sessionId });

    const messages = await (testPrisma as any).chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(4);
    expect(messages.map((m: { content: string }) => m.content)).toEqual([
      'الرسالة الأولى',
      expect.stringMatching(/test reply for:/),
      'الرسالة الثانية',
      expect.stringMatching(/test reply for:/),
    ]);
  });
});
