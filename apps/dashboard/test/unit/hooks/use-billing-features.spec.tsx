/**
 * use-billing-features.spec.tsx
 *
 * Tests the new useFeatureFlagMap() shim that reads from Plan.limits
 * (via useBillingFeatures → GET /dashboard/billing/my-features) instead
 * of the removed FeatureFlag table endpoints.
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: apiGetMock },
}))

import { useFeatureFlagMap } from "@/hooks/use-billing-features"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useFeatureFlagMap", () => {
  beforeEach(() => {
    apiGetMock.mockReset()
  })

  it("isEnabled returns true when features[key].enabled === true", async () => {
    apiGetMock.mockResolvedValue({
      planSlug: "pro",
      status: "ACTIVE",
      features: {
        multi_branch: { enabled: true },
        walk_in_bookings: { enabled: false },
      },
    })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })

    await waitFor(() =>
      expect(result.current.isEnabled("multi_branch")).toBe(true),
    )
    expect(result.current.isEnabled("walk_in_bookings")).toBe(false)
    expect(result.current.isEnabled("unknown_key")).toBe(false)
  })

  it("isEnabled returns false for all keys before data loads", () => {
    apiGetMock.mockReturnValue(new Promise(() => undefined))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })
    expect(result.current.isEnabled("multi_branch")).toBe(false)
  })

  it("isEnabled returns false when features entry is absent", async () => {
    apiGetMock.mockResolvedValue({
      planSlug: "basic",
      status: "TRIALING",
      features: {},
    })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(result.current.isEnabled("multi_branch")).toBe(false)
  })
})
