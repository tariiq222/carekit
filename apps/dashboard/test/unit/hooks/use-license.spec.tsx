import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useUpdateLicense } from "@/hooks/use-license"
import * as apiModule from "@/lib/api/license"
import { queryKeys } from "@/lib/query-keys"

vi.mock("@/lib/api/license", () => ({
  updateLicense: vi.fn(),
}))

const updateLicense = apiModule.updateLicense as ReturnType<typeof vi.fn>

describe("useUpdateLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateLicense.mockResolvedValue(undefined)
  })

  it("should call updateLicense with payload", async () => {
    const queryClient = new QueryClient()
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }
    const { result } = renderHook(() => useUpdateLicense(), { wrapper: Wrapper })
    const payload = { plan: "pro", expiresAt: "2027-01-01" }
    await act(async () => {
      result.current.mutate(payload)
    })
    await vi.waitFor(() => {
      expect(updateLicense).toHaveBeenCalledWith(payload)
    })
  })

  it("should invalidate license.all and featureFlags.map() on success", async () => {
    const queryClient = new QueryClient()
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useUpdateLicense(), { wrapper: Wrapper })

    await act(async () => {
      result.current.mutate({ plan: "pro" })
    })

    await vi.waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2)
    })

    const calledKeys = invalidateQueriesSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown }).queryKey,
    )

    expect(calledKeys).toContainEqual([...queryKeys.license.all])
    expect(calledKeys).toContainEqual(queryKeys.featureFlags.map())
  })
})
