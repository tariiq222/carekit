import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchZatcaConfig,
  fetchOnboardingStatus,
  fetchSandboxStats,
  onboardZatca,
  reportToSandbox,
} = vi.hoisted(() => ({
  fetchZatcaConfig: vi.fn(),
  fetchOnboardingStatus: vi.fn(),
  fetchSandboxStats: vi.fn(),
  onboardZatca: vi.fn(),
  reportToSandbox: vi.fn(),
}))

vi.mock("@/lib/api/zatca", () => ({
  fetchZatcaConfig,
  fetchOnboardingStatus,
  fetchSandboxStats,
  onboardZatca,
  reportToSandbox,
}))

import {
  useZatcaConfig,
  useOnboardingStatus,
  useSandboxStats,
  useZatcaMutations,
} from "@/hooks/use-zatca"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useZatcaConfig", () => {
  beforeEach(() => vi.clearAllMocks())

  it("is in loading state initially", () => {
    fetchZatcaConfig.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useZatcaConfig(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it("fetches and returns ZATCA config", async () => {
    const mockConfig = { vatNumber: "300123456700003", env: "production" }
    fetchZatcaConfig.mockResolvedValueOnce(mockConfig)

    const { result } = renderHook(() => useZatcaConfig(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(mockConfig)
    expect(fetchZatcaConfig).toHaveBeenCalledTimes(1)
  })
})

describe("useOnboardingStatus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches onboarding status and returns it", async () => {
    const mockStatus = { phase: "PRODUCTION", isOnboarded: true }
    fetchOnboardingStatus.mockResolvedValueOnce(mockStatus)

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(mockStatus)
    expect(fetchOnboardingStatus).toHaveBeenCalledTimes(1)
  })

  it("exposes error when fetch fails", async () => {
    fetchOnboardingStatus.mockRejectedValueOnce(new Error("unauthorized"))

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe("useSandboxStats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches sandbox stats and returns them", async () => {
    const mockStats = { reported: 10, failed: 1 }
    fetchSandboxStats.mockResolvedValueOnce(mockStats)

    const { result } = renderHook(() => useSandboxStats(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(mockStats)
    expect(fetchSandboxStats).toHaveBeenCalledTimes(1)
  })
})

describe("useZatcaMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("onboardMut calls onboardZatca with payload", async () => {
    onboardZatca.mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useZatcaMutations(), {
      wrapper: makeWrapper(),
    })

    const payload = { vatNumber: "300123456700003", csid: "abc" }

    await act(async () => {
      await result.current.onboardMut.mutateAsync(
        payload as Parameters<typeof onboardZatca>[0],
      )
    })

    expect(onboardZatca).toHaveBeenCalledWith(payload, expect.anything())
  })

  it("reportMut calls reportToSandbox with invoiceId", async () => {
    reportToSandbox.mockResolvedValueOnce({ reported: true })

    const { result } = renderHook(() => useZatcaMutations(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.reportMut.mutateAsync("inv-99")
    })

    expect(reportToSandbox).toHaveBeenCalledWith("inv-99", expect.anything())
  })

  it("onboardMut and reportMut invalidate all zatca queries on success", async () => {
    onboardZatca.mockResolvedValueOnce({})

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useZatcaMutations(), { wrapper })

    await act(async () => {
      await result.current.onboardMut.mutateAsync(
        {} as Parameters<typeof onboardZatca>[0],
      )
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["zatca"] }),
    )
  })

  it("both mutations are idle before being called", () => {
    const { result } = renderHook(() => useZatcaMutations(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.onboardMut.isPending).toBe(false)
    expect(result.current.reportMut.isPending).toBe(false)
  })
})
