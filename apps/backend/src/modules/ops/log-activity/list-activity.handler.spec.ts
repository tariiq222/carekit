import { ListActivityHandler } from './list-activity.handler';

const mockLogs = [
  { id: 'log-1', action: 'CREATE', entity: 'Booking', createdAt: new Date() },
];

const buildPrisma = () => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue(mockLogs),
    count: jest.fn().mockResolvedValue(1),
  },
});

describe('ListActivityHandler', () => {
  it('returns paginated activity logs', async () => {
    const prisma = buildPrisma();
    const handler = new ListActivityHandler(prisma as never);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(prisma.activityLog.findMany).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});
