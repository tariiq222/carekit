import { DashboardCommsController } from './comms.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listNotifications = fn({ data: [], meta: {} });
  const getUnreadCount = fn({ count: 0 });
  const markRead = fn({ updated: 1 });
  const listEmailTemplates = fn({ data: [] });
  const getEmailTemplate = fn({ id: 'tpl-1' });
  const createEmailTemplate = fn({ id: 'tpl-1' });
  const updateEmailTemplate = fn({ id: 'tpl-1' });
  const previewEmailTemplate = fn({ subject: 's', html: 'h' });
  const listConversations = fn({ data: [] });
  const listMessages = fn({ data: [] });
  const getConversation = fn({ id: 'cv-1' });
  const closeConversation = fn({ id: 'cv-1' });
  const sendStaffMessage = fn({ id: 'msg-1' });
  const listContactMessages = fn({ data: [] });
  const updateContactMessageStatus = fn({ id: 'cm-1' });
  const getOrgSmsConfig = fn({ provider: 'NONE', credentialsConfigured: false });
  const upsertOrgSmsConfig = fn({ provider: 'NONE', credentialsConfigured: false });
  const testSmsConfig = fn({ ok: true });
  const prisma = { smsDelivery: { findMany: jest.fn().mockResolvedValue([]) } };
  const tenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-A') };
  const controller = new DashboardCommsController(
    listNotifications as never, getUnreadCount as never, markRead as never,
    listEmailTemplates as never, getEmailTemplate as never, createEmailTemplate as never,
    updateEmailTemplate as never, previewEmailTemplate as never,
    listConversations as never, listMessages as never,
    getConversation as never, closeConversation as never, sendStaffMessage as never,
    listContactMessages as never, updateContactMessageStatus as never,
    getOrgSmsConfig as never, upsertOrgSmsConfig as never, testSmsConfig as never,
    prisma as never, tenant as never,
  );
  return {
    controller, listNotifications, getUnreadCount, markRead,
    listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, previewEmailTemplate,
    listConversations, listMessages, getConversation, closeConversation, sendStaffMessage,
    listContactMessages, updateContactMessageStatus,
  };
}

describe('DashboardCommsController', () => {
  it('listNotificationsEndpoint — passes recipientId with defaults', async () => {
    const { controller, listNotifications } = buildController();
    await controller.listNotificationsEndpoint({ sub: 'user-1' } as never, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 'user-1', page: 1, limit: 20 }),
    );
  });

  it('markReadEndpoint — passes recipientId', async () => {
    const { controller, markRead } = buildController();
    await controller.markReadEndpoint({ sub: 'user-1' } as never, { ids: ['n-1'] } as never);
    expect(markRead.execute).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'user-1' }));
  });

  it('listEmailTemplatesEndpoint — passes page and limit', async () => {
    const { controller, listEmailTemplates } = buildController();
    await controller.listEmailTemplatesEndpoint({} as never);
    expect(listEmailTemplates.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('getEmailTemplateEndpoint — passes id', async () => {
    const { controller, getEmailTemplate } = buildController();
    await controller.getEmailTemplateEndpoint('tpl-1');
    expect(getEmailTemplate.execute).toHaveBeenCalledWith({ id: 'tpl-1' });
  });

  it('createEmailTemplateEndpoint — delegates to handler', async () => {
    const { controller, createEmailTemplate } = buildController();
    await controller.createEmailTemplateEndpoint({ type: 'BOOKING_CONFIRMED' } as never);
    expect(createEmailTemplate.execute).toHaveBeenCalled();
  });

  it('updateEmailTemplateEndpoint — passes id', async () => {
    const { controller, updateEmailTemplate } = buildController();
    await controller.updateEmailTemplateEndpoint('tpl-1', { subject: 'Updated' } as never);
    expect(updateEmailTemplate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tpl-1' }),
    );
  });

  it('listConversationsEndpoint — passes defaults', async () => {
    const { controller, listConversations } = buildController();
    await controller.listConversationsEndpoint({} as never);
    expect(listConversations.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('listMessagesEndpoint — passes conversationId', async () => {
    const { controller, listMessages } = buildController();
    await controller.listMessagesEndpoint('conv-1', {} as never);
    expect(listMessages.execute).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1' }),
    );
  });
});