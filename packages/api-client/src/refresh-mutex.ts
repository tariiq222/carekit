/**
 * Ensures only one /auth/refresh call is in-flight at a time.
 * Multiple 401s queue and reuse the same refresh promise.
 */
let refreshPromise: Promise<string> | null = null

export function getRefreshMutex(): Promise<string> | null {
  return refreshPromise
}

export function setRefreshMutex(p: Promise<string>): void {
  refreshPromise = p
  p.finally(() => {
    refreshPromise = null
  })
}
