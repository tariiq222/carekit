"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { fetchBookingStats } from "@/lib/api/bookings"
import { fetchLicenseFeatures } from "@/lib/api/license"
import { queryKeys } from "@/lib/query-keys"
import { navGroups } from "@/components/sidebar-config"
import { prefetchRouteData } from "@/lib/route-prefetch"
import type { NavItem } from "@/components/sidebar-config"

/** Maps nav href → feature flag key */
const FEATURE_FLAG_MAP: Record<string, string> = {
  "/coupons": "coupons",
  "/gift-cards": "gift_cards",
  "/intake-forms": "intake_forms",
  "/chatbot": "chatbot",
  "/ratings": "ratings",
  "/branches": "multi_branch",
  "/reports": "reports",
}

export interface NavGroupFiltered {
  labelKey: string
  items: NavItem[]
}

export function useSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  /* ── bookings badge ── */
  const { data: bookingStats } = useQuery({
    queryKey: queryKeys.bookings.stats(),
    queryFn: fetchBookingStats,
    staleTime: 5 * 60_000,
  })
  const actionableBookings = bookingStats
    ? (bookingStats.pending ?? 0) + (bookingStats.pendingCancellation ?? 0)
    : undefined

  /* ── license features (controls sidebar visibility) ── */
  const { data: licenseFeatures } = useQuery({
    queryKey: queryKeys.license.features(),
    queryFn: fetchLicenseFeatures,
    staleTime: 5 * 60_000,
  })

  // Build a map of { flagKey: licensed } for fast lookup
  const licensedMap = useMemo(() => {
    if (!licenseFeatures) return null
    return licenseFeatures.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.key] = f.licensed
      return acc
    }, {})
  }, [licenseFeatures])

  /* ── permission + license filtered nav groups ── */
  const filteredGroups = useMemo<NavGroupFiltered[]>(
    () =>
      navGroups.map((group) => ({
        labelKey: group.labelKey,
        items: group.items.filter((item) => {
          // Permission check
          if (item.permission && !user?.permissions.includes(item.permission)) return false
          // License check — hide nav item if feature is explicitly not licensed
          const flagKey = FEATURE_FLAG_MAP[item.href]
          if (flagKey && licensedMap) {
            return licensedMap[flagKey] !== false
          }
          return true
        }),
      })),
    [user?.permissions, licensedMap]
  )

  /* ── user display info ── */
  const userInitials = useMemo(
    () => (user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "??"),
    [user]
  )
  const userName = useMemo(
    () => (user ? `${user.firstName} ${user.lastName}` : "—"),
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
    actionableBookings,
    userInitials,
    userName,
    isItemActive,
    navigate,
    prefetchItem,
  }
}
