import { DashboardAiController } from './ai.controller';

const TENANT = 'tenant-1';
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
  const controller = new DashboardAiController(knowledgeBase as never, chatCompletion as never);
  return { controller, knowledgeBase, chatCompletion };
}

describe('DashboardAiController', () => {
  it('listDocuments — passes tenantId', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.listDocuments(TENANT, {} as never);
    expect(knowledgeBase.listDocuments).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.getDocument(TENANT, 'doc-1');
    expect(knowledgeBase.getDocument).toHaveBeenCalledWith({ tenantId: TENANT, documentId: 'doc-1' });
  });

  it('updateDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.updateDocument(TENANT, 'doc-1', { isActive: false } as never);
    expect(knowledgeBase.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, documentId: 'doc-1' }),
    );
  });

  it('deleteDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.deleteDocument(TENANT, 'doc-1');
    expect(knowledgeBase.deleteDocument).toHaveBeenCalledWith({ tenantId: TENANT, documentId: 'doc-1' });
  });

  it('chatCompletionEndpoint — passes tenantId', async () => {
    const { controller, chatCompletion } = buildController();
    await controller.chatCompletionEndpoint(TENANT, { messages: [] } as never);
    expect(chatCompletion.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});