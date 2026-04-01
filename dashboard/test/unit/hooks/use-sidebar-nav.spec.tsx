import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchBookingStats } = vi.hoisted(() => ({
  fetchBookingStats: vi.fn(),
}))

const { usePathname, useRouter } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ prefetch: vi.fn(), push: vi.fn() })),
}))

const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn<() => { user: { firstName: string; lastName: string; role: string; permissions: string[] } | null }>(() => ({
    user: {
      firstName: "Ali",
      lastName: "Hassan",
      role: "ADMIN",
      permissions: [] as string[],
    },
  })),
}))

const { navGroups } = vi.hoisted(() => ({
  navGroups: [
    {
      labelKey: "nav.main",
      items: [
        { titleKey: "nav.bookings", href: "/bookings", icon: {} },
        { titleKey: "nav.patients", href: "/patients", icon: {}, permission: "patients:read" },
      ],
    },
  ],
}))

const { prefetchRouteData } = vi.hoisted(() => ({
  prefetchRouteData: vi.fn(),
}))

vi.mock("next/navigation", () => ({ usePathname, useRouter }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth }))
vi.mock("@/lib/api/bookings", () => ({ fetchBookingStats }))
vi.mock("@/components/sidebar-config", () => ({ navGroups }))
vi.mock("@/lib/route-prefetch", () => ({ prefetchRouteData }))

import { useSidebarNav } from "@/hooks/use-sidebar-nav"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useSidebarNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePathname.mockReturnValue("/")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push: vi.fn() })
    useAuth.mockReturnValue({
      user: {
        firstName: "Ali",
        lastName: "Hassan",
        role: "ADMIN",
        permissions: [] as string[],
      },
    })
  })

  it("returns filteredGroups with items that have no permission requirement", async () => {
    fetchBookingStats.mockResolvedValue({ pending: 0, pendingCancellation: 0 })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    // bookings has no permission, patients has permission:read but user has none
    expect(result.current.filteredGroups).toHaveLength(1)
    const items = result.current.filteredGroups[0].items
    expect(items.some((i) => i.href === "/bookings")).toBe(true)
    expect(items.some((i) => i.href === "/patients")).toBe(false)
  })

  it("includes permission-gated items when user has the permission", async () => {
    useAuth.mockReturnValue({
      user: {
        firstName: "Ali",
        lastName: "Hassan",
        role: "ADMIN",
        permissions: ["patients:read"] as string[],
      },
    })
    fetchBookingStats.mockResolvedValue({ pending: 0, pendingCancellation: 0 })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    const items = result.current.filteredGroups[0].items
    expect(items.some((i) => i.href === "/patients")).toBe(true)
  })

  it("fetches booking stats and exposes actionableBookings", async () => {
    fetchBookingStats.mockResolvedValue({ pending: 3, pendingCancellation: 2 })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    await waitFor(() =>
      expect(result.current.actionableBookings).toBe(5),
    )
    expect(fetchBookingStats).toHaveBeenCalled()
  })

  it("actionableBookings is undefined before stats load", () => {
    fetchBookingStats.mockReturnValue(new Promise(() => undefined))

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.actionableBookings).toBeUndefined()
  })

  it("returns user display info from auth", async () => {
    fetchBookingStats.mockResolvedValue({})

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.userInitials).toBe("AH")
    expect(result.current.userName).toBe("Ali Hassan")
  })

  it("isItemActive returns true for exact root path", () => {
    fetchBookingStats.mockResolvedValue({})
    usePathname.mockReturnValue("/")

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.isItemActive("/")).toBe(true)
    expect(result.current.isItemActive("/bookings")).toBe(false)
  })

  it("isItemActive returns true for pathname starting with href", () => {
    fetchBookingStats.mockResolvedValue({})
    usePathname.mockReturnValue("/bookings/123")

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.isItemActive("/bookings")).toBe(true)
  })

  it("navigate does not push when already on exact href", () => {
    fetchBookingStats.mockResolvedValue({})
    const push = vi.fn()
    usePathname.mockReturnValue("/bookings")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    result.current.navigate("/bookings")
    expect(push).not.toHaveBeenCalled()
  })

  it("navigate pushes when on a sub-page of the same section", () => {
    fetchBookingStats.mockResolvedValue({})
    const push = vi.fn()
    usePathname.mockReturnValue("/practitioners/new")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    result.current.navigate("/practitioners")
    expect(push).toHaveBeenCalledWith("/practitioners")
  })

  it("returns ?? for userInitials when user is null", async () => {
    useAuth.mockReturnValue({ user: null })
    fetchBookingStats.mockResolvedValue({})

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.userInitials).toBe("??")
    expect(result.current.userName).toBe("—")
  })
})
