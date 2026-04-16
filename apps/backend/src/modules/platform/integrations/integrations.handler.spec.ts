import { Test } from '@nestjs/testing';
import { UpsertIntegrationHandler } from './upsert-integration.handler';
import { ListIntegrationsHandler } from './list-integrations.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('Integration handlers', () => {
  let upsert: UpsertIntegrationHandler;
  let list: ListIntegrationsHandler;
  let prisma: { integration: { upsert: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpsertIntegrationHandler,
        ListIntegrationsHandler,
        {
          provide: PrismaService,
          useValue: { integration: { upsert: jest.fn(), findMany: jest.fn() } },
        },
      ],
    }).compile();

    upsert = module.get(UpsertIntegrationHandler);
    list = module.get(ListIntegrationsHandler);
    prisma = module.get(PrismaService);
  });

  it('upserts integration config', async () => {
    prisma.integration.upsert.mockResolvedValue({ id: 'int-1', provider: 'zoom' });
    const result = await upsert.execute({ provider: 'zoom', config: { apiKey: 'key' } });
    expect(result.id).toBe('int-1');
    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { provider: 'zoom' } }),
    );
  });

  it('lists active integrations', async () => {
    prisma.integration.findMany.mockResolvedValue([{ id: 'int-1' }]);
    const result = await list.execute();
    expect(result).toHaveLength(1);
    expect(prisma.integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});
