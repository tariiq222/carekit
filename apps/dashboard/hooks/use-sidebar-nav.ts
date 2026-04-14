"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { queryKeys } from "@/lib/query-keys"
import { navGroups } from "@/components/sidebar-config"
import { prefetchRouteData } from "@/lib/route-prefetch"
import type { NavItem } from "@/components/sidebar-config"

export interface NavGroupFiltered {
  labelKey: string
  items: NavItem[]
}

export function useSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  /* ── permission-filtered nav groups ── */
  const filteredGroups = useMemo<NavGroupFiltered[]>(
    () =>
      navGroups.map((group) => ({
        labelKey: group.labelKey,
        items: group.items.filter((item) => {
          if (item.permission && !user?.permissions?.includes(item.permission)) return false
          return true
        }),
      })),
    [user?.permissions]
  )

  /* ── user display info ── */
  const userInitials = useMemo(
    () => (user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "??" : "??"),
    [user]
  )
  const userName = useMemo(
    () => (user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "—" : "—"),
    [user]
  )

  /* ── active route check ── */
  const isItemActive = useCallback(
    (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href)),
    [pathname]
  )

  /* ── navigation ── */
  const navigate = useCallback(
    (href: string, closeMobile?: () => void) => {
      const isExact = href === "/" ? pathname === "/" : pathname === href
      if (isExact) return
      closeMobile?.()
      router.push(href)
    },
    [pathname, router]
  )

  const prefetchItem = useCallback(
    (href: string) => {
      if (isItemActive(href)) return
      router.prefetch(href)
      prefetchRouteData(href, queryClient)
    },
    [isItemActive, router, queryClient]
  )

  return {
    filteredGroups,
    pathname,
    userInitials,
    userName,
    isItemActive,
    navigate,
    prefetchItem,
  }
}
