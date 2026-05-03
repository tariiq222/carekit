import { ListTenantDeliveryLogsHandler } from './list-tenant-delivery-logs.handler';
import { DeliveryStatus } from '@prisma/client';

describe('ListTenantDeliveryLogsHandler', () => {
  const orgId = 'org-1';
  const mockLogs = [
    {
      id: 'log-1',
      organizationId: orgId,
      recipientId: 'user-1',
      type: 'BOOKING_CONFIRMED',
      priority: 'STANDARD',
      channel: 'EMAIL',
      status: 'SENT',
      senderActor: 'PLATFORM_FALLBACK',
      toAddress: 'user@example.com',
      providerName: 'platform-smtp',
      attempts: 1,
      lastAttemptAt: new Date('2026-05-01T10:00:00Z'),
      sentAt: new Date('2026-05-01T10:00:01Z'),
      errorMessage: null,
      createdAt: new Date('2026-05-01T10:00:00Z'),
    },
  ];

  const prisma = {
    notificationDeliveryLog: {
      findMany: jest.fn().mockResolvedValue(mockLogs),
      count: jest.fn().mockResolvedValue(1),
    },
  } as any;

  const tenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue(orgId) } as any;

  let handler: ListTenantDeliveryLogsHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ListTenantDeliveryLogsHandler(prisma, tenant);
  });

  it('queries with organizationId from tenant context', async () => {
    await handler.execute({ page: 1, perPage: 20 });
    expect(prisma.notificationDeliveryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: orgId }),
      }),
    );
  });

  it('applies status filter when provided', async () => {
    await handler.execute({ page: 1, perPage: 20, status: DeliveryStatus.SENT });
    expect(prisma.notificationDeliveryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: DeliveryStatus.SENT }),
      }),
    );
  });

  it('returns paginated result', async () => {
    const result = await handler.execute({ page: 1, perPage: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });
});
