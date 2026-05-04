import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import {
  listTemplates,
  getTemplate,
  updateTemplate,
  previewTemplate,
  testSend,
  listLogs,
} from '@/features/platform-email/platform-email.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

describe('platform-email API', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  // ── listTemplates ──────────────────────────────────────────────────────────

  describe('listTemplates', () => {
    it('calls the correct URL', async () => {
      vi.mocked(adminRequest).mockResolvedValue([]);
      await listTemplates();
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates');
    });

    it('returns the API result', async () => {
      const mockTemplates = [
        { id: 't1', slug: 'welcome', name: 'Welcome', isActive: true, isLocked: false, version: 1, updatedAt: '2026-01-01T00:00:00Z' },
      ];
      vi.mocked(adminRequest).mockResolvedValue(mockTemplates);
      const result = await listTemplates();
      expect(result).toEqual(mockTemplates);
    });
  });

  // ── getTemplate ────────────────────────────────────────────────────────────

  describe('getTemplate', () => {
    it('calls the correct URL with slug', async () => {
      vi.mocked(adminRequest).mockResolvedValue({});
      await getTemplate('welcome-email');
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/welcome-email');
    });

    it('encodes slug in path', async () => {
      vi.mocked(adminRequest).mockResolvedValue({});
      await getTemplate('tenant-welcome');
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/tenant-welcome');
    });
  });

  // ── updateTemplate ─────────────────────────────────────────────────────────

  describe('updateTemplate', () => {
    it('sends PATCH with correct URL, method, body, and content-type header', async () => {
      vi.mocked(adminRequest).mockResolvedValue({});
      const body = { name: 'New Name', subjectAr: 'الموضوع', subjectEn: 'Subject', htmlBody: '<p>Hi</p>', isActive: true };
      await updateTemplate('welcome-email', body);
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/welcome-email', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends partial body (only isActive)', async () => {
      vi.mocked(adminRequest).mockResolvedValue({});
      await updateTemplate('locked-tpl', { isActive: false });
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/locked-tpl', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  // ── previewTemplate ────────────────────────────────────────────────────────

  describe('previewTemplate', () => {
    it('sends POST to preview URL with empty vars by default', async () => {
      vi.mocked(adminRequest).mockResolvedValue({ subject: 'Hello', html: '<p>Hello</p>' });
      await previewTemplate('welcome-email');
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/welcome-email/preview', {
        method: 'POST',
        body: JSON.stringify({ vars: {} }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends POST to preview URL with provided vars', async () => {
      vi.mocked(adminRequest).mockResolvedValue({ subject: 'Hi John', html: '<p>Hi John</p>' });
      const vars = { name: 'John', clinic: 'Test Clinic' };
      await previewTemplate('welcome-email', vars);
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/templates/welcome-email/preview', {
        method: 'POST',
        body: JSON.stringify({ vars }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  // ── testSend ───────────────────────────────────────────────────────────────

  describe('testSend', () => {
    it('sends POST to /platform-email/test-send with full body', async () => {
      vi.mocked(adminRequest).mockResolvedValue({ ok: true });
      const body = { slug: 'welcome-email', to: 'admin@deqah.app', vars: { clinic: 'Test' } };
      await testSend(body);
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/test-send', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends POST with minimal body (no vars)', async () => {
      vi.mocked(adminRequest).mockResolvedValue({ ok: false, reason: 'No API key' });
      const body = { slug: 'billing-receipt', to: 'owner@clinic.sa' };
      const result = await testSend(body);
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/test-send', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual({ ok: false, reason: 'No API key' });
    });
  });

  // ── listLogs ───────────────────────────────────────────────────────────────

  describe('listLogs', () => {
    const EMPTY_RESULT = { items: [], nextCursor: null };

    it('calls base URL with no query when called with empty object', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({});
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/logs');
    });

    it('calls base URL when called with no argument', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs();
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/logs');
    });

    it('appends status param', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ status: 'FAILED' });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('status=FAILED');
    });

    it('appends templateSlug param', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ templateSlug: 'welcome-email' });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('templateSlug=welcome-email');
    });

    it('appends organizationId param', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ organizationId: 'org-abc-123' });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('organizationId=org-abc-123');
    });

    it('appends cursor param', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ cursor: 'cursor-xyz' });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('cursor=cursor-xyz');
    });

    it('appends limit param', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ limit: 25 });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('limit=25');
    });

    it('combines multiple params', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ status: 'SENT', limit: 50, organizationId: 'org-1' });
      const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
      expect(url).toContain('status=SENT');
      expect(url).toContain('limit=50');
      expect(url).toContain('organizationId=org-1');
      expect(url).toMatch(/^\/platform-email\/logs\?/);
    });

    it('does NOT include undefined optional params in the URL', async () => {
      vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
      await listLogs({ status: undefined, templateSlug: undefined });
      expect(adminRequest).toHaveBeenCalledWith('/platform-email/logs');
    });
  });
});
