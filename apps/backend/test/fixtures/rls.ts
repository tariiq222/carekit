import type { RlsHelper } from '../../src/common/tenant/rls.helper';

export function createRlsHelper(): RlsHelper {
  return {
    applyInTransaction: jest.fn().mockResolvedValue(undefined),
  } as unknown as RlsHelper;
}

export function createMockedRlsHelper(overrides: Partial<RlsHelper> = {}): RlsHelper {
  return {
    applyInTransaction: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RlsHelper;
}
