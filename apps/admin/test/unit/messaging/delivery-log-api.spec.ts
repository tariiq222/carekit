import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import {
  listDeliveryLog,
} from '@/features/notifications/list-delivery-log/list-delivery-log.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

const EMPTY_RESPONSE = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

describe('listDeliveryLog API', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('calls base URL when no filters provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({});
    expect(adminRequest).toHaveBeenCalledWith('/notifications/delivery-log');
  });

  it('appends organizationId when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ organizationId: 'org-uuid-123' });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('organizationId=org-uuid-123');
    expect(url).toMatch(/^\/notifications\/delivery-log\?/);
  });

  it('omits status when value is "all"', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ status: 'all' });
    expect(adminRequest).toHaveBeenCalledWith('/notifications/delivery-log');
  });

  it('appends status when not "all"', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ status: 'FAILED' });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('status=FAILED');
  });

  it('omits channel when value is "all"', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ channel: 'all' });
    expect(adminRequest).toHaveBeenCalledWith('/notifications/delivery-log');
  });

  it('appends channel when not "all"', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ channel: 'EMAIL' });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('channel=EMAIL');
  });

  it('appends page param', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ page: 3 });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('page=3');
  });

  it('appends perPage param', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ perPage: 50 });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('perPage=50');
  });

  it('combines multiple filters', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({
      organizationId: 'org-1',
      status: 'SENT',
      channel: 'SMS',
      page: 2,
      perPage: 20,
    });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('organizationId=org-1');
    expect(url).toContain('status=SENT');
    expect(url).toContain('channel=SMS');
    expect(url).toContain('page=2');
    expect(url).toContain('perPage=20');
    expect(url).toMatch(/^\/notifications\/delivery-log\?/);
  });

  it('does NOT append status when undefined', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ page: 1 });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).not.toContain('status');
  });

  it('does NOT append channel when undefined', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    await listDeliveryLog({ page: 1 });
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).not.toContain('channel');
  });

  it('returns the API response', async () => {
    const mockResponse = {
      items: [
        {
          id: 'dl-1',
          organizationId: 'org-1',
          recipientId: 'user-1',
          type: 'BOOKING_CONFIRMED',
          priority: 'STANDARD' as const,
          channel: 'EMAIL' as const,
          status: 'SENT' as const,
          toAddress: 'owner@clinic.sa',
          providerName: 'resend',
          attempts: 1,
          lastAttemptAt: '2026-05-01T10:00:00Z',
          sentAt: '2026-05-01T10:00:01Z',
          errorMessage: null,
          jobId: 'job-abc',
          createdAt: '2026-05-01T10:00:00Z',
        },
      ],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(adminRequest).mockResolvedValue(mockResponse);
    const result = await listDeliveryLog({});
    expect(result).toEqual(mockResponse);
  });
});
