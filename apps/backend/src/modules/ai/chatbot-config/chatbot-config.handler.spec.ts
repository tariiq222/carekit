import { GetChatbotConfigHandler } from './get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from './upsert-chatbot-config.handler';

const buildPrisma = () => ({
  chatbotConfig: {
    upsert: jest.fn().mockResolvedValue({ id: 'cfg-1', organizationId: 'org-A' }),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

describe('GetChatbotConfigHandler', () => {
  it('upserts the singleton row by organizationId (lazy-create on first read)', async () => {
    const prisma = buildPrisma();
    const handler = new GetChatbotConfigHandler(prisma as never, buildTenant('org-A') as never);
    const res = await handler.execute();
    expect(res.organizationId).toBe('org-A');
    expect(prisma.chatbotConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      update: {},
      create: { organizationId: 'org-A' },
    });
  });
});

describe('UpsertChatbotConfigHandler', () => {
  it('upserts provided fields into the org singleton', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertChatbotConfigHandler(prisma as never, buildTenant('org-A') as never);
    await handler.execute({
      systemPromptAr: 'prompt-ar',
      greetingEn: 'hi',
      escalateToHumanAt: 3,
    });
    expect(prisma.chatbotConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      create: expect.objectContaining({
        organizationId: 'org-A',
        systemPromptAr: 'prompt-ar',
        greetingEn: 'hi',
        escalateToHumanAt: 3,
      }),
      update: expect.objectContaining({
        systemPromptAr: 'prompt-ar',
        greetingEn: 'hi',
        escalateToHumanAt: 3,
      }),
    });
  });

  it('ignores undefined fields (no field-overwrite with null)', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertChatbotConfigHandler(prisma as never, buildTenant('org-A') as never);
    await handler.execute({ greetingAr: 'مرحبا' });
    const callArg = prisma.chatbotConfig.upsert.mock.calls[0][0];
    expect(callArg.update).toEqual({ greetingAr: 'مرحبا' });
  });
});
