"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { navGroups } from "@/components/sidebar-config"
import { prefetchRouteData } from "@/lib/route-prefetch"
import { useBillingFeatures } from "@/hooks/use-billing-features"
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

  /* ── billing features (used for featureFlag filtering) ── */
  const { data: billingData, isLoading: featuresLoading } = useBillingFeatures()
  const features = billingData?.features

  /* ── permission + featureFlag filtered nav groups ── */
  const filteredGroups = useMemo<NavGroupFiltered[]>(
    () =>
      navGroups.map((group) => ({
        labelKey: group.labelKey,
        items: group.items.filter((item) => {
          // 1. Permission gate — hide if user lacks the required permission
          if (
            item.permission &&
            !user?.permissions?.includes(item.permission)
          ) {
            return false
          }

          // 2. Feature flag gate — while billing features are still loading,
          //    show all items to avoid a jarring sidebar flash on first paint.
          //    Once features have resolved, hide items whose flag is disabled.
          if (item.featureFlag) {
            if (!featuresLoading && !features?.[item.featureFlag]?.enabled) {
              return false
            }
          }

          return true
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.permissions, features, featuresLoading]
  )

  /* ── user display info ── */
  const userInitials = useMemo(() => {
    if (!user) return "??"
    const parts = user.name?.trim().split(/\s+/).filter(Boolean) ?? []
    return (
      parts
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || "??"
    )
  }, [user])

  const userName = useMemo(
    () => user?.name?.trim() || user?.email || "—",
    [user]
  )

  /* ── active route check ── */
  const isItemActive = useCallback(
    (href: string) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href),
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
    /** True while billing features are being fetched (first load only). */
    featuresLoading,
    pathname,
    userInitials,
    userName,
    isItemActive,
    navigate,
    prefetchItem,
  }
}
