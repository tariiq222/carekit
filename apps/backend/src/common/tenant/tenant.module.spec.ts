import { ConfigService } from '@nestjs/config';
import { TenantModule } from './tenant.module';

const buildModule = (mode: string) => {
  const config = { get: jest.fn().mockReturnValue(mode) } as unknown as ConfigService;
  return new TenantModule(config);
};

describe('TenantModule.onApplicationBootstrap', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('passes silently when strict in production', () => {
    process.env.NODE_ENV = 'production';
    const m = buildModule('strict');
    expect(() => m.onApplicationBootstrap()).not.toThrow();
  });

  it('throws in production when TENANT_ENFORCEMENT is not strict (P0: must fail boot)', () => {
    process.env.NODE_ENV = 'production';
    expect(() => buildModule('permissive').onApplicationBootstrap()).toThrow(
      /TENANT_ENFORCEMENT/i,
    );
    expect(() => buildModule('off').onApplicationBootstrap()).toThrow(
      /TENANT_ENFORCEMENT/i,
    );
  });

  it('passes silently in development with permissive or off', () => {
    process.env.NODE_ENV = 'development';
    expect(() => buildModule('permissive').onApplicationBootstrap()).not.toThrow();
    expect(() => buildModule('off').onApplicationBootstrap()).not.toThrow();
  });

  it('passes silently in test env regardless of mode', () => {
    process.env.NODE_ENV = 'test';
    expect(() => buildModule('off').onApplicationBootstrap()).not.toThrow();
  });
});
