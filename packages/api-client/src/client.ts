import { getRefreshMutex, setRefreshMutex } from './refresh-mutex'

export interface ClientConfig {
  baseUrl: string
  getAccessToken: () => string | null
  getRefreshToken?: () => string | null
  onTokenRefreshed: (accessToken: string, refreshToken: string) => void
  onAuthFailure: () => void
}

let config: ClientConfig | null = null

export function initClient(cfg: ClientConfig): void {
  config = cfg
}

async function doRefresh(): Promise<string> {
  if (!config) throw new Error('api-client not initialized')
  const refreshToken = config.getRefreshToken?.()
  const res = await fetch(`${config.baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  })
  if (!res.ok) {
    config.onAuthFailure()
    throw new Error('Refresh failed')
  }
  const raw = (await res.json()) as unknown
  const data =
    raw && typeof raw === 'object' && 'success' in raw && 'data' in raw
      ? ((raw as { data: { accessToken: string; refreshToken: string } }).data)
      : (raw as { accessToken: string; refreshToken: string })
  config.onTokenRefreshed(data.accessToken, data.refreshToken)
  return data.accessToken
}

// Auth endpoints must NEVER trigger the 401-refresh flow:
// - /auth/login: a 401 means bad credentials, not an expired session
// - /auth/refresh: refresh failure should surface directly, not loop
// - /auth/logout: 401 here is meaningless and would mask the original error
const AUTH_ENDPOINTS_NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout']

function isAuthEndpoint(path: string): boolean {
  return AUTH_ENDPOINTS_NO_RETRY.some((suffix) => path.endsWith(suffix))
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  if (!config) throw new Error('api-client not initialized')

  const token = config.getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers })

  if (res.status === 401 && !retried && !isAuthEndpoint(path)) {
    let mutex = getRefreshMutex()
    if (!mutex) {
      mutex = doRefresh()
      setRefreshMutex(mutex)
    }
    await mutex
    return apiRequest<T>(path, options, true)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      (body as { message?: string }).message ?? res.statusText,
      body,
    )
  }

  if (res.status === 204) return undefined as T
  const json = (await res.json()) as unknown
  // Backend wraps every response as { success: true, data: T }.
  // Unwrap transparently so callers receive the raw T.
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data
  }
  return json as T
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
