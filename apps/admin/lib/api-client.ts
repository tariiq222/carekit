// Raw fetch wrapper — no feature knowledge. Every slice in features/* imports
// this and narrows it with its own request type + parser.

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const ADMIN_BASE = '/api/proxy/admin';
const PUBLIC_BASE = '/api/proxy';

function tokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('admin.accessToken');
}

async function doFetch<T>(url: string, init: RequestInit, sendAuth: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (sendAuth) {
    const token = tokenFromStorage();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers, credentials: 'include' });

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

export function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return doFetch<T>(`${ADMIN_BASE}${path}`, init, true);
}

export function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return doFetch<T>(`${PUBLIC_BASE}${path}`, init, false);
}
