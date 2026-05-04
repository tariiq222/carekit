import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import {
  getNotificationsConfig,
  updateNotificationsConfig,
} from '@/features/notifications-settings/notifications-settings.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

const MOCK_CONFIG = {
  defaultChannels: ['EMAIL', 'PUSH'] as const,
  quietHours: { startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' },
  fcm: { serverKey: '***', projectId: 'my-project', clientEmail: 'sdk@my-project.iam.gserviceaccount.com' },
};

describe('notifications-settings API', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  // ── getNotificationsConfig ─────────────────────────────────────────────────

  describe('getNotificationsConfig', () => {
    it('calls GET /notifications-config', async () => {
      vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
      await getNotificationsConfig();
      expect(adminRequest).toHaveBeenCalledWith('/notifications-config');
    });

    it('returns the API response', async () => {
      vi.mocked(adminRequest).mockResolvedValue(MOCK_CONFIG);
      const result = await getNotificationsConfig();
      expect(result).toEqual(MOCK_CONFIG);
    });

    it('propagates errors from the API', async () => {
      vi.mocked(adminRequest).mockRejectedValue(new Error('Unauthorized'));
      await expect(getNotificationsConfig()).rejects.toThrow('Unauthorized');
    });
  });

  // ── updateNotificationsConfig ──────────────────────────────────────────────

  describe('updateNotificationsConfig', () => {
    it('sends PUT /notifications-config with correct body', async () => {
      vi.mocked(adminRequest).mockResolvedValue(undefined);
      const body = {
        defaultChannels: ['EMAIL', 'SMS', 'PUSH', 'INAPP'] as const,
        quietHours: { startHour: 23, endHour: 7, timezone: 'UTC' },
        fcm: { projectId: 'proj-id', clientEmail: 'sdk@proj.iam.gserviceaccount.com' },
      };
      await updateNotificationsConfig(body);
      expect(adminRequest).toHaveBeenCalledWith('/notifications-config', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends PUT with partial fcm (only serverKey)', async () => {
      vi.mocked(adminRequest).mockResolvedValue(undefined);
      const body = {
        defaultChannels: ['EMAIL'] as const,
        quietHours: { startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' },
        fcm: { serverKey: 'new-secret-key' },
      };
      await updateNotificationsConfig(body);
      expect(adminRequest).toHaveBeenCalledWith('/notifications-config', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends PUT with empty fcm (no credential update)', async () => {
      vi.mocked(adminRequest).mockResolvedValue(undefined);
      const body = {
        defaultChannels: ['PUSH'] as const,
        quietHours: { startHour: 0, endHour: 6, timezone: 'Africa/Cairo' },
        fcm: {},
      };
      await updateNotificationsConfig(body);
      expect(adminRequest).toHaveBeenCalledWith('/notifications-config', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('propagates errors from the API', async () => {
      vi.mocked(adminRequest).mockRejectedValue(new Error('Forbidden'));
      await expect(
        updateNotificationsConfig({
          defaultChannels: ['EMAIL'],
          quietHours: { startHour: 22, endHour: 8, timezone: 'UTC' },
          fcm: {},
        }),
      ).rejects.toThrow('Forbidden');
    });
  });
});
