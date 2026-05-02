import { DashboardAiController } from './ai.controller';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });
const kbFn = () => ({
  listDocuments: jest.fn().mockResolvedValue({ data: [] }),
  getDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
  updateDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
  deleteDocument: jest.fn().mockResolvedValue(undefined),
});

function buildController() {
  const knowledgeBase = kbFn();
  const chatCompletion = fn({ content: 'Hello' });
  const getChatbotConfig = fn({});
  const upsertChatbotConfig = fn({});
  const controller = new DashboardAiController(
    knowledgeBase as never,
    chatCompletion as never,
    getChatbotConfig as never,
    upsertChatbotConfig as never,
  );
  return { controller, knowledgeBase, chatCompletion, getChatbotConfig, upsertChatbotConfig };
}

describe('DashboardAiController', () => {
  it('listDocuments — delegates to knowledgeBase', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.listDocuments({} as never);
    expect(knowledgeBase.listDocuments).toHaveBeenCalledWith({});
  });

  it('getDocument — passes documentId', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.getDocument('doc-1');
    expect(knowledgeBase.getDocument).toHaveBeenCalledWith({ documentId: 'doc-1' });
  });

  it('updateDocument — passes documentId and body', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.updateDocument('doc-1', { isActive: false } as never);
    expect(knowledgeBase.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1' }),
    );
  });

  it('deleteDocument — passes documentId', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.deleteDocument('doc-1');
    expect(knowledgeBase.deleteDocument).toHaveBeenCalledWith({ documentId: 'doc-1' });
  });

  it('chatCompletionEndpoint — delegates body to handler', async () => {
    const { controller, chatCompletion } = buildController();
    await controller.chatCompletionEndpoint({ userMessage: 'hi' } as never);
    expect(chatCompletion.execute).toHaveBeenCalledWith({ userMessage: 'hi' });
  });
});

describe('@RequireFeature metadata — AI_CHATBOT', () => {
  it.each([
    'listDocuments',
    'getDocument',
    'updateDocument',
    'deleteDocument',
    'getChatbotConfigEndpoint',
    'upsertChatbotConfigEndpoint',
    'chatCompletionEndpoint',
  ])('annotates %s with FeatureKey.AI_CHATBOT', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardAiController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.AI_CHATBOT);
  });
});
