import { Navigate } from '@tanstack/react-router'
import { useAuthStore } from '../stores/auth.store.js'
import type { FeatureFlags } from '@carekit/api-client'

interface Props {
  flag: keyof FeatureFlags
  children: React.ReactNode
  /** If true, renders null instead of redirecting — for use inside components */
  silent?: boolean
}

/**
 * Enforces feature flags at both route and component level.
 * - At route level (silent=false): redirects to / when flag is off
 * - At component level (silent=true): returns null when flag is off
 *
 * A flag being false means the feature does not exist for this clinic.
 */
export function FeatureGuard({ flag, children, silent = false }: Props) {
  const hasFlag = useAuthStore((s) => s.hasFlag(flag))
  if (!hasFlag) {
    if (silent) return null
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
