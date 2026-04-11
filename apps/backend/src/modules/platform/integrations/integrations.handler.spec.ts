import { Test } from '@nestjs/testing';
import { UpsertIntegrationHandler } from './upsert-integration.handler';
import { ListIntegrationsHandler } from './list-integrations.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('Integration handlers', () => {
  let upsert: UpsertIntegrationHandler;
  let list: ListIntegrationsHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

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
    const result = await upsert.execute({ tenantId: 'tenant-1', provider: 'zoom', config: { apiKey: 'key' } });
    expect(result.id).toBe('int-1');
  });

  it('lists active integrations for tenant', async () => {
    prisma.integration.findMany.mockResolvedValue([{ id: 'int-1' }]);
    const result = await list.execute('tenant-1');
    expect(result).toHaveLength(1);
  });
});
