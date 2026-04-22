import { CreateNotificationHandler } from './create-notification.handler';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

describe('CreateNotificationHandler', () => {
  it('creates a notification record tagged with organizationId', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    const handler = new CreateNotificationHandler(prisma as never, tenant as never);
    const result = await handler.execute({
      recipientId: 'client-1',
      recipientType: RecipientType.CLIENT,
      type: NotificationType.GENERAL,
      title: 'Test',
      body: 'Hello',
    });
    expect(result.id).toBe('notif-1');
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recipientId: 'client-1', organizationId: 'org-A' }),
    });
  });
});
