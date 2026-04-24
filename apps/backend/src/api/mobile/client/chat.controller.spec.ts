import { MobileClientChatController } from './chat.controller';

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
