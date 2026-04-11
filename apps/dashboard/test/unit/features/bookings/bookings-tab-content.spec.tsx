/**
 * bookings-tab-content.spec.tsx
 *
 * Tests the feature flag guard for walk_in filter option:
 * - walk_in filter option is included when isEnabled('walk_in') = true
 * - walk_in filter option is excluded when isEnabled('walk_in') = false
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mock all dependencies to isolate the walk_in filter logic ─────────────────

const { useBookings, useBookingMutations } = vi.hoisted(() => ({
  useBookings: vi.fn(() => ({
    bookings: [],
    stats: null,
    meta: null,
    loading: false,
    statsLoading: false,
    error: null,
    filters: { type: "all" },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    hasFilters: false,
    setPage: vi.fn(),
  })),
  useBookingMutations: vi.fn(() => ({
    confirmMut: { mutateAsync: vi.fn(), isPending: false },
    noShowMut: { mutateAsync: vi.fn(), isPending: false },
    adminCancelMut: { mutateAsync: vi.fn(), isPending: false },
  })),
}))

const { usePractitioners } = vi.hoisted(() => ({
  usePractitioners: vi.fn(() => ({ practitioners: [] })),
}))

const { useClinicConfig } = vi.hoisted(() => ({
  useClinicConfig: vi.fn(() => ({ weekStartDayNumber: 0 })),
}))

const { useFeatureFlagMap } = vi.hoisted(() => ({
  useFeatureFlagMap: vi.fn(() => ({
    map: {},
    isEnabled: vi.fn(() => true),
  })),
}))

const { useQueryClient } = vi.hoisted(() => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
  useQueryClient,
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-bookings", () => ({ useBookings, useBookingMutations }))
vi.mock("@/hooks/use-practitioners", () => ({ usePractitioners }))
vi.mock("@/hooks/use-clinic-config", () => ({ useClinicConfig }))
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureFlagMap }))
vi.mock("@/lib/api/bookings", () => ({}))
vi.mock("@/components/features/data-table", () => ({
  DataTable: ({ emptyTitle }: { emptyTitle: string }) => <div data-testid="data-table">{emptyTitle}</div>,
}))
vi.mock("@/components/features/stats-grid", () => ({
  StatsGrid: ({ children }: { children: ReactNode }) => <div data-testid="stats-grid">{children}</div>,
}))
vi.mock("@/components/features/stat-card", () => ({
  StatCard: () => <div data-testid="stat-card" />,
}))
vi.mock("@/components/features/filter-bar", () => ({
  FilterBar: ({ selects }: { selects: Array<{ options: Array<{ value: string }> }> }) => (
    <div data-testid="filter-bar">
      {selects?.map((s, i) =>
        s.options.map((o) => <span key={`${i}-${o.value}`} data-testid={`option-${o.value}`} />),
      )}
    </div>
  ),
}))
vi.mock("@/components/features/error-banner", () => ({
  ErrorBanner: () => null,
}))
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))
vi.mock("@/components/features/bookings/booking-columns", () => ({
  getBookingColumns: vi.fn(() => []),
}))
vi.mock("@/components/features/bookings/cancel-dialogs", () => ({
  AdminCancelDialog: () => null,
}))
vi.mock("@/components/locale-provider", () => ({ useLocale }))

import { BookingsTabContent } from "@/components/features/bookings/bookings-tab-content"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

describe("BookingsTabContent — walk_in feature flag guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("includes walk_in filter option when isEnabled('walk_in') = true", () => {
    useFeatureFlagMap.mockReturnValue({
      map: { walk_in: true },
      isEnabled: (key: string) => key === "walk_in",
    })

    render(<BookingsTabContent onRowClick={vi.fn()} onEditClick={vi.fn()} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.getByTestId("option-walk_in")).toBeTruthy()
  })

  it("excludes walk_in filter option when isEnabled('walk_in') = false", () => {
    useFeatureFlagMap.mockReturnValue({
      map: { walk_in: false },
      isEnabled: (key: string) => key === "walk_in" ? false : true,
    })

    render(<BookingsTabContent onRowClick={vi.fn()} onEditClick={vi.fn()} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.queryByTestId("option-walk_in")).toBeNull()
  })
})
