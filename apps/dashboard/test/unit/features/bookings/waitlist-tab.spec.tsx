/**
 * waitlist-tab.spec.tsx
 *
 * Tests the feature flag guard: WaitlistTab returns null when waitlist is disabled.
 */

import { render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mock dependencies ─────────────────────────────────────────────────────────

const mockEntries: unknown[] = []

const { useWaitlist, useWaitlistMutations } = vi.hoisted(() => ({
  useWaitlist: vi.fn(() => ({
    entries: mockEntries,
    isLoading: false,
    error: null,
    status: undefined,
    setStatus: vi.fn(),
    resetFilters: vi.fn(),
    refetch: vi.fn(),
  })),
  useWaitlistMutations: vi.fn(() => ({
    removeMut: { mutate: vi.fn(), isPending: false },
  })),
}))

const { useFeatureFlagMap } = vi.hoisted(() => ({
  useFeatureFlagMap: vi.fn(() => ({
    map: {},
    isEnabled: vi.fn(() => true),
  })),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-waitlist", () => ({ useWaitlist, useWaitlistMutations }))
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureFlagMap }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { WaitlistTab } from "@/components/features/bookings/waitlist-tab"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

describe("WaitlistTab — feature flag guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when isEnabled('waitlist') = false", () => {
    useFeatureFlagMap.mockReturnValue({
      map: { waitlist: false },
      isEnabled: (key: string) => key === "waitlist" ? false : true,
    })

    const { container } = render(<WaitlistTab />, { wrapper: makeWrapper() })
    // When waitlist is disabled the component returns null — container is empty
    expect(container.firstChild).toBeNull()
  })

  it("renders normally when isEnabled('waitlist') = true", () => {
    useFeatureFlagMap.mockReturnValue({
      map: { waitlist: true },
      isEnabled: (key: string) => key === "waitlist" ? true : false,
    })
    // Mock non-empty entries so the component renders the list instead of empty state
    useWaitlist.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      status: undefined,
      setStatus: vi.fn(),
      resetFilters: vi.fn(),
      refetch: vi.fn(),
    })

    const { container } = render(<WaitlistTab />, { wrapper: makeWrapper() })
    // When enabled, component renders (not null)
    expect(container.firstChild).not.toBeNull()
  })
})
