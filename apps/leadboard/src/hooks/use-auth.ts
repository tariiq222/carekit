import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authApi, featureFlagsApi, whitelabelApi } from '@carekit/api-client'
import { useAuthStore } from '@/lib/stores/auth.store'
import { applyWhitelabel } from '@/lib/whitelabel/apply'

export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const authRes = await authApi.login(payload)
      const [wl, flags] = await Promise.all([
        whitelabelApi.getWhitelabelConfig(),
        featureFlagsApi.getFeatureFlags(),
      ])
      return { authRes, wl, flags }
    },
    onSuccess: ({ authRes, wl, flags }) => {
      setAuth({
        user: authRes.user,
        whitelabel: wl,
        featureFlags: flags,
        accessToken: authRes.accessToken,
        refreshToken: authRes.refreshToken,
      })
      applyWhitelabel(wl)
      navigate({ to: '/' })
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth()
      navigate({ to: '/login', replace: true })
    },
  })
}
