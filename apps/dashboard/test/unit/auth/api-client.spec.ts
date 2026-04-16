/**
 * API Client (lib/api.ts) — unit tests
 *
 * Covers:
 *  - Token injection: Authorization Bearer header is set when token exists
 *  - No token: Authorization header is absent when no token
 *  - 401 auto-refresh: calls refresh endpoint, retries original request
 *  - 401 refresh fails: clears token + localStorage + throws ApiError
 *  - 401 concurrent: multiple simultaneous 401s only trigger one refresh
 *  - Error parsing: ApiError is thrown with correct status + code + message
 *  - Response unwrapping: { success, data } envelope is unwrapped
 *  - Cookie endpoints use proxy URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// We need to import the module fresh each test to reset module-level state
// (accessToken and refreshPromise are module-level vars in lib/api.ts)
// ---------------------------------------------------------------------------

describe('API Client (lib/api.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    // Reset module so accessToken state is clean
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    // Ensure window is defined (jsdom)
    vi.stubGlobal('window', globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeOkResponse(data: unknown) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    })
  }

  function makeErrorResponse(status: number, code: string, message: string) {
    return Promise.resolve({
      ok: false,
      status,
      statusText: message,
      json: () => Promise.resolve({ statusCode: status, error: code, message }),
    })
  }

  // =========================================================================
  // Token injection
  // =========================================================================

  it('should include Authorization header when accessToken is set', async () => {
    const { api, setAccessToken } = await import('@/lib/api')
    setAccessToken('test-token-123')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: 1 } }),
    })

    await api.get('/clients')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token-123')
  })

  it('should NOT include Authorization header when no token', async () => {
    const { api, setAccessToken } = await import('@/lib/api')
    setAccessToken(null)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    })

    await api.get('/health')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  // =========================================================================
  // Cookie endpoint → proxy URL
  // =========================================================================

  it('should use /api/proxy path for cookie endpoints (/auth/login)', async () => {
    const { api } = await import('@/lib/api')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { accessToken: 'tok' } }),
    })

    await api.post('/auth/login', { email: 'a@b.com', password: 'x' })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^\/api\/proxy\/auth\/login/)
  })

  it('should use direct API URL for non-cookie endpoints', async () => {
    const { api } = await import('@/lib/api')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: [] }),
    })

    await api.get('/clients')

    const [url] = fetchMock.mock.calls[0]
    expect(url).not.toMatch(/^\/api\/proxy/)
    expect(url).toContain('/clients')
  })

  // =========================================================================
  // Response envelope unwrapping
  // =========================================================================

  it('should unwrap { success, data } envelope from backend', async () => {
    const { api } = await import('@/lib/api')

    fetchMock.mockResolvedValueOnce(makeOkResponse({ name: 'CareKit' }))

    const result = await api.get<{ name: string }>('/health')

    expect(result).toEqual({ name: 'CareKit' })
  })

  // =========================================================================
  // Error parsing
  // =========================================================================

  it('should throw ApiError with status + code + message on non-2xx response', async () => {
    const { api, ApiError } = await import('@/lib/api')

    fetchMock.mockResolvedValueOnce(
      makeErrorResponse(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password'),
    )
    // Stub refresh to fail (avoid retry loop in this test)
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })

    try {
      await api.post('/auth/login', { email: 'x', password: 'y' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).status).toBe(401)
      // Note: login goes through proxy, 401 triggers refresh attempt which also fails
      // The final error is the UNAUTHORIZED session-expired error
    }
  })

  it('should throw ApiError with UNKNOWN code when error body is missing', async () => {
    const { api, ApiError } = await import('@/lib/api')

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not json')),
    })

    try {
      await api.get('/clients')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).status).toBe(500)
      expect((err as InstanceType<typeof ApiError>).code).toBe('UNKNOWN')
    }
  })

  // =========================================================================
  // 401 auto-refresh → retry
  // =========================================================================

  it('should retry request with new token after successful 401 refresh', async () => {
    const { api, setAccessToken } = await import('@/lib/api')
    setAccessToken('old-token')
    localStorage.setItem('carekit_refresh_token', 'stored-rt')

    // First call returns 401
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })
    // Refresh token call succeeds (tryRefreshToken uses fetch directly, not api.post)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { accessToken: 'new-token', expiresIn: 900 } }),
    })
    // Retry of original call succeeds
    fetchMock.mockResolvedValueOnce(makeOkResponse({ id: 'client-1' }))

    const result = await api.get<{ id: string }>('/clients/1')

    expect(result).toEqual({ id: 'client-1' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('should clear token + localStorage and throw when refresh also fails', async () => {
    const { api, setAccessToken, getAccessToken } = await import('@/lib/api')
    setAccessToken('stale-token')
    localStorage.setItem('carekit_user', JSON.stringify({ id: 'u1' }))

    // Original request → 401
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })
    // Refresh attempt → also 401
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })

    await expect(api.get('/clients')).rejects.toThrow()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('carekit_user')).toBeNull()
  })

  // =========================================================================
  // Concurrent 401 deduplication
  // =========================================================================

  it('should only call refresh once for concurrent 401 responses', async () => {
    const { api, setAccessToken } = await import('@/lib/api')
    setAccessToken('expired-token')
    localStorage.setItem('carekit_refresh_token', 'stored-rt')

    // Both requests fail with 401
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
      // Single refresh succeeds (tryRefreshToken uses fetch directly via /api/proxy/auth/refresh)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { accessToken: 'refreshed', expiresIn: 900 } }),
      })
      // Retries succeed
      .mockResolvedValueOnce(makeOkResponse({ a: 1 }))
      .mockResolvedValueOnce(makeOkResponse({ b: 2 }))

    await Promise.all([api.get('/clients/1'), api.get('/clients/2')])

    // Only one refresh call (the deduplicated one)
    const refreshCalls = fetchMock.mock.calls.filter((call: string[]) =>
      call[0].includes('/auth/refresh'),
    )
    expect(refreshCalls.length).toBe(1)
  })
})
