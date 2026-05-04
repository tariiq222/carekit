import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    ApiError: actual.ApiError,
  };
});

describe('list-audit-log.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs URL with page and perPage', async () => {
    const { listAuditLog } = await import('@/features/audit-log/list-audit-log/list-audit-log.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listAuditLog({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/audit-log?page=1&perPage=20', {});
  });

  it('adds optional filters to query string', async () => {
    const { listAuditLog } = await import('@/features/audit-log/list-audit-log/list-audit-log.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 2, perPage: 10, total: 0 } });

    await listAuditLog({
      page: 2,
      perPage: 10,
      actionType: 'USER_SUSPENDED',
      organizationId: 'org-1',
      superAdminUserId: 'admin-2',
      from: '2025-01-01',
      to: '2025-12-31',
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/admin/audit-log?page=2&perPage=10&actionType=USER_SUSPENDED&organizationId=org-1&superAdminUserId=admin-2&from=2025-01-01&to=2025-12-31',
      {},
    );
  });

  it('omits actionType when it is "all"', async () => {
    const { listAuditLog } = await import('@/features/audit-log/list-audit-log/list-audit-log.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listAuditLog({ page: 1, perPage: 20, actionType: 'all' });

    const call = mockApiRequest.mock.calls[0] as [string, unknown];
    expect(call[0]).not.toContain('actionType');
  });

  it('returns typed ListAuditLogResponse', async () => {
    const { listAuditLog } = await import('@/features/audit-log/list-audit-log/list-audit-log.api');
    const mockEntry = { id: 'log-1', actionType: 'ORG_CREATED', reason: 'new clinic', metadata: {}, ipAddress: '1.1.1.1', userAgent: 'chrome', createdAt: '2025-01-01', superAdminUserId: 'a-1', organizationId: 'o-1', impersonationSessionId: null };
    const mockResponse = { items: [mockEntry], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await listAuditLog({ page: 1, perPage: 20 });

    expect(result.items[0].actionType).toBe('ORG_CREATED');
  });
});
