import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { fetchFeatureFlags, fetchFeatureFlagMap, updateFeatureFlag, toastError } = vi.hoisted(() => ({
  fetchFeatureFlags: vi.fn(),
  fetchFeatureFlagMap: vi.fn(),
  updateFeatureFlag: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/lib/api/feature-flags", () => ({
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))

import {
  useFeatureFlags,
  useFeatureFlagMap,
  useFeatureFlagMutation,
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
    updateFeatureFlag.mockReset()
    toastError.mockReset()
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
    updateFeatureFlag.mockReset()
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

describe("useFeatureFlagMutation", () => {
  beforeEach(() => {
    updateFeatureFlag.mockReset()
    toastError.mockReset()
  })

  it("calls updateFeatureFlag with key and enabled", async () => {
    updateFeatureFlag.mockResolvedValue(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMutation(), { wrapper: Wrapper })
    await result.current.toggleMut.mutateAsync({ key: "chatbot", enabled: true })
    expect(updateFeatureFlag).toHaveBeenCalledWith("chatbot", true)
  })

  it("invalidates both the flags list and the flag map on success", async () => {
    updateFeatureFlag.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useFeatureFlagMutation(), { wrapper: Wrapper })
    await result.current.toggleMut.mutateAsync({ key: "chatbot", enabled: true })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["feature-flags"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["feature-flag-map"] })
  })

  it("toasts a plan-restriction message when the API returns 403", async () => {
    updateFeatureFlag.mockRejectedValue({ response: { status: 403 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMutation(), { wrapper: Wrapper })
    await expect(result.current.toggleMut.mutateAsync({ key: "chatbot", enabled: true })).rejects.toBeTruthy()
    expect(toastError).toHaveBeenCalledWith("هذه الميزة غير متاحة في باقتك الحالية")
  })

  it("does not toast the plan message for non-403 errors", async () => {
    updateFeatureFlag.mockRejectedValue({ response: { status: 500 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFeatureFlagMutation(), { wrapper: Wrapper })
    await expect(result.current.toggleMut.mutateAsync({ key: "chatbot", enabled: true })).rejects.toBeTruthy()
    expect(toastError).not.toHaveBeenCalled()
  })
})
