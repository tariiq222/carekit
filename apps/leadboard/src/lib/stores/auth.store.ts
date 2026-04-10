import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserPayload, WhitelabelConfig, FeatureFlags } from '@carekit/api-client'
import { DEFAULT_FEATURE_FLAGS } from '@carekit/api-client'

interface AuthState {
  user: UserPayload | null
  whitelabel: WhitelabelConfig | null
  featureFlags: FeatureFlags
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (payload: {
    user: UserPayload
    whitelabel: WhitelabelConfig
    featureFlags: Record<string, boolean>
    accessToken: string
    refreshToken: string
  }) => void
  updateTokens: (accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  hasFlag: (flag: keyof FeatureFlags) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      whitelabel: null,
      featureFlags: DEFAULT_FEATURE_FLAGS,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, whitelabel, featureFlags, accessToken, refreshToken }) =>
        set({
          user,
          whitelabel,
          featureFlags: { ...DEFAULT_FEATURE_FLAGS, ...featureFlags } as FeatureFlags,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      updateTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      clearAuth: () =>
        set({
          user: null,
          whitelabel: null,
          featureFlags: DEFAULT_FEATURE_FLAGS,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      hasFlag: (flag) => get().featureFlags[flag] === true,
    }),
    {
      name: 'carekit-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        whitelabel: s.whitelabel,
        featureFlags: s.featureFlags,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
)
