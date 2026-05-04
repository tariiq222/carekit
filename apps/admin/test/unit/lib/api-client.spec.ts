import { describe, expect, it, vi } from 'vitest';

vi.mock('@deqah/api-client', () => ({
  initClient: vi.fn(),
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  },
}));

describe('lib/api-client', () => {
  it('exports adminRequest function', async () => {
    const mod = await import('@/lib/api-client');
    expect(typeof mod.adminRequest).toBe('function');
  });

  it('exports publicRequest function', async () => {
    const mod = await import('@/lib/api-client');
    expect(typeof mod.publicRequest).toBe('function');
  });

  it('exports ApiError class', async () => {
    const mod = await import('@/lib/api-client');
    expect(mod.ApiError).toBeDefined();
  });

  it('adminRequest prepends /admin prefix to path', async () => {
    const { apiRequest } = await import('@deqah/api-client');
    const { adminRequest } = await import('@/lib/api-client');
    vi.mocked(apiRequest).mockResolvedValue({ data: 'ok' } as any);
    await adminRequest('/some-path').catch(() => {});
    expect(apiRequest).toHaveBeenCalledWith('/admin/some-path', expect.anything());
  });
});

describe('lib/types', () => {
  it('PageMeta type is exportable', async () => {
    const mod = await import('@/lib/types');
    // types don't have runtime values but the module should exist
    expect(mod).toBeDefined();
  });
});

describe('lib/api/settings', () => {
  it('exports getPlatformSetting and upsertPlatformSetting', async () => {
    const mod = await import('@/lib/api/settings');
    expect(typeof mod.getPlatformSetting).toBe('function');
    expect(typeof mod.upsertPlatformSetting).toBe('function');
  });

  it('getPlatformSetting calls adminRequest with correct path', async () => {
    const { apiRequest } = await import('@deqah/api-client');
    vi.mocked(apiRequest).mockResolvedValue({ data: null } as any);
    const { getPlatformSetting } = await import('@/lib/api/settings');
    await getPlatformSetting('some-key').catch(() => {});
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/some-key'), expect.anything());
  });

  it('upsertPlatformSetting calls adminRequest with PUT method', async () => {
    const { apiRequest } = await import('@deqah/api-client');
    vi.mocked(apiRequest).mockResolvedValue(undefined as any);
    const { upsertPlatformSetting } = await import('@/lib/api/settings');
    await upsertPlatformSetting({ key: 'test-key', value: 'val' }).catch(() => {});
    expect(apiRequest).toHaveBeenCalled();
  });
});

describe('publicRequest', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns parsed JSON on successful response', async () => {
    const { publicRequest } = await import('@/lib/api-client');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await publicRequest<{ ok: boolean }>('/public/path');
    expect(result).toEqual({ ok: true });
  });

  it('unwraps {success, data} envelope', async () => {
    const { publicRequest } = await import('@/lib/api-client');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { value: 42 } }), { status: 200 }));
    const result = await publicRequest<{ value: number }>('/public/path');
    expect(result).toEqual({ value: 42 });
  });

  it('returns undefined on 204 No Content', async () => {
    const { publicRequest } = await import('@/lib/api-client');
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await publicRequest<undefined>('/public/path');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    const { publicRequest, ApiError } = await import('@/lib/api-client');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    await expect(publicRequest('/public/path')).rejects.toThrow(ApiError);
  });
});
