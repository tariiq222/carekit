import { CreateNotificationHandler } from './create-notification.handler';
import type { PrismaService } from '../../../infrastructure/database';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  },
});

describe('CreateNotificationHandler', () => {
  it('creates a notification record', async () => {
    const prisma = buildPrisma();
    const handler = new CreateNotificationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      recipientId: 'client-1',
      recipientType: RecipientType.CLIENT,
      type: NotificationType.GENERAL,
      title: 'Test',
      body: 'Hello',
    });
    expect(result.id).toBe('notif-1');
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', recipientId: 'client-1' }),
    });
  });
});
