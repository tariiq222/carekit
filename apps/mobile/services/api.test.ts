jest.mock('@/stores/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn() }));
jest.mock('@/stores/secure-storage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

import api from './api';
import { TENANT_ID } from '@/constants/config';

describe('api interceptor', () => {
  it('attaches X-Org-Id header from TENANT_ID constant', async () => {
    let config: any = { headers: {} };
    const handlers = (api.interceptors.request as any).handlers as Array<{
      fulfilled: (c: any) => Promise<any> | any;
    }>;
    for (const h of handlers) {
      if (h && typeof h.fulfilled === 'function') {
        config = await h.fulfilled(config);
      }
    }
    expect(config.headers['X-Org-Id']).toBe(TENANT_ID);
  });
});
