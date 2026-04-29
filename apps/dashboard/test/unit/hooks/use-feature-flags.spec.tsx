import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { fetchFeatureFlags, fetchFeatureFlagMap } = vi.hoisted(() => ({
  fetchFeatureFlags: vi.fn(),
  fetchFeatureFlagMap: vi.fn(),
}))

vi.mock("@/lib/api/feature-flags", () => ({
  fetchFeatureFlags,
  fetchFeatureFlagMap,
}))

import {
  useFeatureFlags,
  useFeatureFlagMap,
} from "@/hooks/use-feature-flags"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useFeatureFlags", () => {
  beforeEach(() => {
    fetchFeatureFlags.mockReset()
    fetchFeatureFlagMap.mockReset()
  })

  it("returns the raw flags list", async () => {
    const flags = [{ key: "chatbot", enabled: true }, { key: "zatca", enabled: false }]
    fetchFeatureFlags.mockResolvedValue(flags)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.flags).toEqual(flags)
  })

  it("returns an empty array while data is still loading", () => {
    fetchFeatureFlags.mockReturnValue(new Promise(() => undefined))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: Wrapper })
    expect(result.current.flags).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })
})

describe("useFeatureFlagMap", () => {
  beforeEach(() => {
    fetchFeatureFlags.mockReset()
    fetchFeatureFlagMap.mockReset()
  })

  it("isEnabled returns true only for keys set to true in the map", async () => {
    fetchFeatureFlagMap.mockResolvedValue({ chatbot: true, zatca: false })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.map).toEqual({ chatbot: true, zatca: false }))
    expect(result.current.isEnabled("chatbot")).toBe(true)
    expect(result.current.isEnabled("zatca")).toBe(false)
    expect(result.current.isEnabled("unknown")).toBe(false)
  })

  it("returns an empty map until data loads", () => {
    fetchFeatureFlagMap.mockReturnValue(new Promise(() => undefined))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMap(), { wrapper: Wrapper })
    expect(result.current.map).toEqual({})
    expect(result.current.isEnabled("anything")).toBe(false)
  })
})
