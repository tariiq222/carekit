import { PrismaService } from './prisma.service';

/**
 * Unit-level contract for PrismaService. We never hit a real database in
 * unit tests — the lifecycle hooks are stubbed and we only assert that
 * connect/disconnect are invoked exactly once on each Nest lifecycle event.
 */
describe('PrismaService', () => {
  let service: PrismaService;
  let connectSpy: jest.SpyInstance;
  let disconnectSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new PrismaService();
    connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects when the module initializes', async () => {
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module shuts down', async () => {
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not expose $allTenantsUnsafe', () => {
    // The Proxy whitelist in PrismaService routes whitelisted props to the target (base class).
    // After removal, accessing $allTenantsUnsafe should hit the extended client and return undefined.
    const value = (service as unknown as Record<string, unknown>).$allTenantsUnsafe;
    expect(value).toBeUndefined();
  });
});
