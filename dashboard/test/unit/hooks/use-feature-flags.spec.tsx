import { renderHook, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { createWrapper } from "@/test/helpers/wrapper"
import { queryKeys } from "@/lib/query-keys"

const {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
} = vi.hoisted(() => ({
  fetchFeatureFlags: vi.fn(),
  fetchFeatureFlagMap: vi.fn(),
  updateFeatureFlag: vi.fn(),
}))

vi.mock("@/lib/api/feature-flags", () => ({
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import {
  useFeatureFlags,
  useFeatureFlagMap,
  useFeatureFlagMutation,
} from "@/hooks/use-feature-flags"

describe("useFeatureFlags", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches feature flags", async () => {
    const flags = [{ key: "chatbot", enabled: true }]
    fetchFeatureFlags.mockResolvedValueOnce(flags)

    const { result } = renderHook(() => useFeatureFlags(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.flags).toEqual(flags)
  })

  it("returns empty array while loading", () => {
    fetchFeatureFlags.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useFeatureFlags(), { wrapper: createWrapper() })

    expect(result.current.flags).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })
})

describe("useFeatureFlagMap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to prevent resolved values from leaking between tests
    fetchFeatureFlagMap.mockReset()
  })

  it("returns map with isEnabled helper", async () => {
    fetchFeatureFlagMap.mockResolvedValueOnce({ chatbot: true, ratings: false })

    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isEnabled("chatbot")).toBe(true)
    })
    expect(result.current.isEnabled("ratings")).toBe(false)
    expect(result.current.isEnabled("unknown")).toBe(false)
  })

  it("returns empty map when no data", async () => {
    fetchFeatureFlagMap.mockResolvedValueOnce({})

    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.map).toBeDefined())
    expect(result.current.isEnabled("anything")).toBe(false)
  })

  it("useFeatureFlagMap has refetchOnMount: true — refetches on remount", async () => {
    // First mount — initial data
    fetchFeatureFlagMap.mockResolvedValueOnce({ multi_branch: true })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    const { result, unmount } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isEnabled("multi_branch")).toBe(true))
    expect(fetchFeatureFlagMap).toHaveBeenCalledTimes(1)

    // Simulate license toggle — invalidate so query becomes stale
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags.map() })
    })

    // Unmount
    unmount()

    // Remount — should refetch due to refetchOnMount: true
    // Note: invalidateQueries also triggers a background refetch, so we need 3 mocks total
    fetchFeatureFlagMap.mockResolvedValueOnce({}) // background refetch from invalidate
    fetchFeatureFlagMap.mockResolvedValueOnce({ multi_branch: false }) // remount refetch

    const { result: result2 } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })

    await waitFor(() => expect(result2.current.isEnabled("multi_branch")).toBe(false))
    // Called: initial mount (1) + invalidate-triggered refetch (2) + remount refetch (3)
    expect(fetchFeatureFlagMap).toHaveBeenCalledTimes(3)
  })

  it("useFeatureFlagMap refetches stale data on remount after invalidation — regression", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    // 1. Initial render with multi_branch: true
    fetchFeatureFlagMap.mockResolvedValueOnce({ multi_branch: true })

    const { result, unmount } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isEnabled("multi_branch")).toBe(true))
    expect(result.current.isEnabled("multi_branch")).toBe(true)

    // 2. Invalidate queries to simulate license toggle
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags.map() })
    })

    // 3. Unmount (simulates navigating away)
    unmount()

    // 4. Remount — fetchFeatureFlagMap should be called again (refetchOnMount: true)
    // invalidateQueries also triggers a background refetch, so we need 3 mocks total
    fetchFeatureFlagMap.mockResolvedValueOnce({}) // background refetch from invalidate
    fetchFeatureFlagMap.mockResolvedValueOnce({ multi_branch: false }) // remount refetch

    const { result: result2 } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })

    // 5. After remount, isEnabled returns updated value
    await waitFor(() => expect(result2.current.isEnabled("multi_branch")).toBe(false))
    expect(result2.current.isEnabled("multi_branch")).toBe(false)
    // Called: initial mount (1) + invalidate-triggered refetch (2) + remount refetch (3)
    expect(fetchFeatureFlagMap).toHaveBeenCalledTimes(3)
  })
})

describe("useFeatureFlagMutation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("toggleMut calls updateFeatureFlag with key and enabled", async () => {
    updateFeatureFlag.mockResolvedValueOnce({ key: "chatbot", enabled: false })

    const { result } = renderHook(() => useFeatureFlagMutation(), { wrapper: createWrapper() })

    result.current.toggleMut.mutate({ key: "chatbot", enabled: false })

    await waitFor(() => expect(updateFeatureFlag).toHaveBeenCalledWith("chatbot", false))
  })
})
