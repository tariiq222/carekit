import { Navigate } from '@tanstack/react-router'
import { useAuthStore } from '../stores/auth.store.js'

interface Props {
  children: React.ReactNode
}

/**
 * Redirects to /login if user is not authenticated.
 * Used in _dashboard/route.tsx.
 */
export function AuthGuard({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
