import { MobileClientChatController } from './chat.controller';
import { REQUIRE_FEATURE_KEY } from '../../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const USER = { id: 'client-1', email: null, phone: null };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const chatCompletion = fn({ reply: 'مرحباً' });
  const listConversations = fn({ data: [], meta: {} });
  const listMessages = fn({ data: [], cursor: null });
  const controller = new MobileClientChatController(
    chatCompletion as never, listConversations as never, listMessages as never,
  );
  return { controller, chatCompletion, listConversations, listMessages };
}

describe('MobileClientChatController', () => {
  it('chat — passes clientId and userMessage', async () => {
    const { controller, chatCompletion } = build();
    await controller.chat(USER, { userMessage: 'مرحبا', sessionId: 'sess-1' } as never);
    expect(chatCompletion.execute).toHaveBeenCalledWith(expect.objectContaining({
      clientId: USER.id, userMessage: 'مرحبا', sessionId: 'sess-1',
    }));
  });

  it('listConversationsEndpoint — passes clientId, defaults', async () => {
    const { controller, listConversations } = build();
    await controller.listConversationsEndpoint(USER, {} as never);
    expect(listConversations.execute).toHaveBeenCalledWith(expect.objectContaining({
      clientId: USER.id, page: 1, limit: 20,
    }));
  });

  it('listMessagesEndpoint — passes conversationId', async () => {
    const { controller, listMessages } = build();
    await controller.listMessagesEndpoint('conv-1', { limit: 30 } as never);
    expect(listMessages.execute).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1', limit: 30,
    }));
  });

  it('chat — bubbles error from handler', async () => {
    const { controller, chatCompletion } = build();
    chatCompletion.execute.mockRejectedValueOnce(new Error('AI unavailable'));
    await expect(controller.chat(USER, { userMessage: 'hi' } as never)).rejects.toThrow('AI unavailable');
  });
});

describe('@RequireFeature metadata — AI_CHATBOT', () => {
  it.each([
    'chat',
    'listConversationsEndpoint',
    'listMessagesEndpoint',
  ])('annotates %s with FeatureKey.AI_CHATBOT', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (MobileClientChatController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.AI_CHATBOT);
  });
});
