/**
 * useSwitchOrganization — SaaS-06
 *
 * Calls POST /auth/switch-org with the target organizationId. On success:
 *   1. Replaces the in-memory access token with the fresh one.
 *   2. Persists the new refresh token (same storage key as login).
 *   3. Flushes ALL TanStack Query caches — org context changed, so
 *      bookings / clients / employees / etc. must be refetched.
 *   4. Refreshes the router so server components re-render with the new JWT.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api, setAccessToken } from "@/lib/api"

interface SwitchOrgResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const REFRESH_KEY = "deqah_refresh_token"

export function useSwitchOrganization() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation<SwitchOrgResponse, Error, string>({
    mutationFn: (organizationId: string) =>
      api.post<SwitchOrgResponse>("/auth/switch-org", { organizationId }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken)
      if (typeof window !== "undefined") {
        localStorage.setItem(REFRESH_KEY, data.refreshToken)
      }
      // Org changed → every tenant-scoped query is stale.
      queryClient.clear()
      router.refresh()
    },
  })
}
