import { adminRequest } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────

export type PlatformEmailLogStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED';

export interface PlatformEmailTemplateListItem {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  isLocked: boolean;
  version: number;
  updatedAt: string;
}

export interface PlatformEmailTemplateDetail extends PlatformEmailTemplateListItem {
  subjectAr: string;
  subjectEn: string;
  htmlBody: string;
  blocks: unknown;
  updatedById: string | null;
  createdAt: string;
}

export interface UpdateTemplateBody {
  name?: string;
  subjectAr?: string;
  subjectEn?: string;
  htmlBody?: string;
  isActive?: boolean;
}

export interface PreviewResult {
  subject: string;
  html: string;
}

export interface TestSendBody {
  slug: string;
  to: string;
  vars?: Record<string, string>;
}

export interface TestSendResult {
  ok: boolean;
  reason?: string;
}

export interface PlatformEmailLogRow {
  id: string;
  organizationId: string | null;
  templateSlug: string;
  toAddress: string;
  status: PlatformEmailLogStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ListLogsResult {
  items: PlatformEmailLogRow[];
  nextCursor: string | null;
}

export interface ListLogsQuery {
  status?: PlatformEmailLogStatus;
  templateSlug?: string;
  organizationId?: string;
  cursor?: string;
  limit?: number;
}

// ── API calls ──────────────────────────────────────────────────────────────

export function listTemplates(): Promise<PlatformEmailTemplateListItem[]> {
  return adminRequest<PlatformEmailTemplateListItem[]>('/platform-email/templates');
}

export function getTemplate(slug: string): Promise<PlatformEmailTemplateDetail> {
  return adminRequest<PlatformEmailTemplateDetail>(`/platform-email/templates/${slug}`);
}

export function updateTemplate(slug: string, body: UpdateTemplateBody): Promise<PlatformEmailTemplateDetail> {
  return adminRequest<PlatformEmailTemplateDetail>(`/platform-email/templates/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function previewTemplate(slug: string, vars: Record<string, string> = {}): Promise<PreviewResult> {
  return adminRequest<PreviewResult>(`/platform-email/templates/${slug}/preview`, {
    method: 'POST',
    body: JSON.stringify({ vars }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function testSend(body: TestSendBody): Promise<TestSendResult> {
  return adminRequest<TestSendResult>('/platform-email/test-send', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function listLogs(q: ListLogsQuery = {}): Promise<ListLogsResult> {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.templateSlug) params.set('templateSlug', q.templateSlug);
  if (q.organizationId) params.set('organizationId', q.organizationId);
  if (q.cursor) params.set('cursor', q.cursor);
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  const qs = params.toString();
  return adminRequest<ListLogsResult>(qs ? `/platform-email/logs?${qs}` : '/platform-email/logs');
}
