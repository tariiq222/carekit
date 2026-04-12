import { DashboardCommsController } from './comms.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 1 });
  const listEmailTemplates = fn({ data: [] });
  const getEmailTemplate = fn({ id: 'tpl-1' });
  const createEmailTemplate = fn({ id: 'tpl-1' });
  const updateEmailTemplate = fn({ id: 'tpl-1' });
  const listConversations = fn({ data: [] });
  const listMessages = fn({ data: [] });
  const controller = new DashboardCommsController(
    listNotifications as never, markRead as never, listEmailTemplates as never,
    getEmailTemplate as never, createEmailTemplate as never, updateEmailTemplate as never,
    listConversations as never, listMessages as never,
  );
  return { controller, listNotifications, markRead, listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, listConversations, listMessages };
}

describe('DashboardCommsController', () => {
  it('listNotificationsEndpoint — passes tenantId with defaults', async () => {
    const { controller, listNotifications } = buildController();
    await controller.listNotificationsEndpoint(TENANT, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1, limit: 20 }),
    );
  });

  it('markReadEndpoint — passes tenantId', async () => {
    const { controller, markRead } = buildController();
    await controller.markReadEndpoint(TENANT, { ids: ['n-1'] } as never);
    expect(markRead.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listEmailTemplatesEndpoint — passes tenantId', async () => {
    const { controller, listEmailTemplates } = buildController();
    await controller.listEmailTemplatesEndpoint(TENANT, {} as never);
    expect(listEmailTemplates.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getEmailTemplateEndpoint — passes tenantId and id', async () => {
    const { controller, getEmailTemplate } = buildController();
    await controller.getEmailTemplateEndpoint(TENANT, 'tpl-1');
    expect(getEmailTemplate.execute).toHaveBeenCalledWith({ tenantId: TENANT, id: 'tpl-1' });
  });

  it('createEmailTemplateEndpoint — passes tenantId', async () => {
    const { controller, createEmailTemplate } = buildController();
    await controller.createEmailTemplateEndpoint(TENANT, { type: 'BOOKING_CONFIRMED' } as never);
    expect(createEmailTemplate.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateEmailTemplateEndpoint — passes tenantId and id', async () => {
    const { controller, updateEmailTemplate } = buildController();
    await controller.updateEmailTemplateEndpoint(TENANT, 'tpl-1', { subject: 'Updated' } as never);
    expect(updateEmailTemplate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, id: 'tpl-1' }),
    );
  });

  it('listConversationsEndpoint — passes tenantId', async () => {
    const { controller, listConversations } = buildController();
    await controller.listConversationsEndpoint(TENANT, {} as never);
    expect(listConversations.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listMessagesEndpoint — passes tenantId and conversationId', async () => {
    const { controller, listMessages } = buildController();
    await controller.listMessagesEndpoint(TENANT, 'conv-1', {} as never);
    expect(listMessages.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, conversationId: 'conv-1' }),
    );
  });
});