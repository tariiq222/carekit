import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

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
  beforeEach(() => { vi.clearAllMocks() })

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
