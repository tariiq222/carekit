"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import {
  login as apiLogin,
  logoutApi,
  fetchMe,
  refreshToken,
} from "@/lib/api/auth"
import type { AuthUser } from "@/lib/api/auth"
import { setAccessToken } from "@/lib/api"

/* ─── Context Shape ─── */

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  permissions: string[]
  login: (email: string, password: string, hCaptchaToken: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  canDo: (module: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefreshRef = useRef<((expiresIn: number) => void) | null>(null)

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max((expiresIn - 120) * 1000, 10_000)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await refreshToken()
        setAccessToken(data.accessToken)
        scheduleRefreshRef.current?.(data.expiresIn)
      } catch {
        setUser(null)
        setPermissions([])
      }
    }, delay)
  }, [])

  // Restore session on mount — refresh token first to get a fresh accessToken
  // and the actual expiresIn, then fetch the user profile.
  // If either fails, the session is truly expired — clear local state.
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh
    refreshToken()
      .then((res) => {
        scheduleRefresh(res.expiresIn)
        return fetchMe()
      })
      .then((u) => {
        setUser(u)
        setPermissions(u.permissions ?? [])
      })
      .catch(() => {
        setUser(null)
        setPermissions([])
        localStorage.removeItem("carekit_user")
      })
      .finally(() => setLoading(false))

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [scheduleRefresh])

  const login = useCallback(async (email: string, password: string, hCaptchaToken: string) => {
    const res = await apiLogin(email, password, hCaptchaToken)
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    await logoutApi()
    setUser(null)
    setPermissions([])
  }, [])

  const canDo = useCallback(
    (module: string, action: string): boolean => {
      return (
        permissions.includes(`${module}:${action}`) ||
        permissions.includes(`${module}:*`) ||
        permissions.includes("*")
      )
    },
    [permissions],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        permissions,
        login,
        logout,
        isAuthenticated: !!user,
        canDo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
