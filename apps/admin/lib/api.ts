// Thin typed fetch wrapper for the admin API. Uses the Next proxy at
// /api/proxy/<rest> (see next.config.mjs) so cookies stay first-party.

const BASE = '/api/proxy/api/v1/admin';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function tokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('admin.accessToken');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenFromStorage();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const maybe = body as { message?: string; error?: string } | null;
    throw new ApiError(
      res.status,
      (maybe?.message ?? maybe?.error ?? res.statusText) as string,
      (maybe?.error ?? undefined) as string | undefined,
    );
  }

  return body as T;
}

export const adminApi = {
  // Auth (shared with dashboard; super-admin login uses the same endpoint)
  login(email: string, password: string) {
    return fetch('/api/proxy/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    }).then(async (r) => {
      const body = (await r.json()) as {
        accessToken?: string;
        refreshToken?: string;
        user?: { isSuperAdmin?: boolean };
        message?: string;
      };
      if (!r.ok) throw new ApiError(r.status, body.message ?? r.statusText);
      return body;
    });
  },

  // Organizations
  listOrganizations(params: URLSearchParams) {
    return request<OrganizationsPage>(`/organizations?${params.toString()}`);
  },
  getOrganization(id: string) {
    return request<OrganizationDetail>(`/organizations/${id}`);
  },
  suspendOrganization(id: string, reason: string) {
    return request<void>(`/organizations/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  reinstateOrganization(id: string, reason: string) {
    return request<void>(`/organizations/${id}/reinstate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Metrics
  platformMetrics() {
    return request<PlatformMetrics>('/metrics/platform');
  },

  // Audit log
  listAuditLog(params: URLSearchParams) {
    return request<AuditLogPage>(`/audit-log?${params.toString()}`);
  },

  // Impersonation
  startImpersonation(body: { organizationId: string; targetUserId: string; reason: string }) {
    return request<{ sessionId: string; shadowAccessToken: string; expiresAt: string; redirectUrl: string }>(
      '/impersonation',
      { method: 'POST', body: JSON.stringify(body) },
    );
  },
  endImpersonation(sessionId: string) {
    return request<void>(`/impersonation/${sessionId}/end`, { method: 'POST' });
  },
  listImpersonationSessions(params: URLSearchParams) {
    return request<ImpersonationSessionsPage>(`/impersonation/sessions?${params.toString()}`);
  },
};

// ─── Shared response shapes ───────────────────────────────────────────────

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface OrganizationRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  status: string;
  verticalId: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

export interface OrganizationsPage {
  items: OrganizationRow[];
  meta: PageMeta;
}

export interface OrganizationDetail extends OrganizationRow {
  stats: {
    memberCount: number;
    bookingCount30d: number;
    totalRevenue: number | string;
  };
}

export interface PlatformMetrics {
  organizations: { total: number; active: number; suspended: number; newThisMonth: number };
  users: { total: number };
  bookings: { totalLast30Days: number };
  revenue: { lifetimePaidSar: number | string };
  subscriptions: {
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface AuditLogEntry {
  id: string;
  superAdminUserId: string;
  actionType: string;
  organizationId: string | null;
  impersonationSessionId: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  meta: PageMeta;
}

export interface ImpersonationSessionRow {
  id: string;
  superAdminUserId: string;
  targetUserId: string;
  organizationId: string;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
  endedReason: string | null;
}

export interface ImpersonationSessionsPage {
  items: ImpersonationSessionRow[];
  meta: PageMeta;
}
