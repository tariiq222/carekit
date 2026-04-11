import { initClient } from '@carekit/api-client'
import { useAuthStore } from './stores/auth.store.js'

/**
 * Called once at app startup (before React renders).
 * Wires api-client to Zustand so interceptors can read/write tokens.
 */
export function initApiClient(baseUrl: string): void {
  initClient({
    baseUrl,
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onTokenRefreshed: (accessToken, refreshToken) => {
      useAuthStore.getState().updateTokens(accessToken, refreshToken)
    },
    onAuthFailure: () => {
      useAuthStore.getState().clearAuth()
      window.location.replace('/login')
    },
  })

  const wl = useAuthStore.getState().whitelabel
  if (wl) {
    import('./whitelabel/apply.js').then(({ applyWhitelabel }) => applyWhitelabel(wl))
  }
}
