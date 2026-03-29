import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchConfigMap, updateConfig } = vi.hoisted(() => ({
  fetchConfigMap: vi.fn(),
  updateConfig: vi.fn(),
}))

vi.mock("@/lib/api/whitelabel", () => ({
  fetchConfigMap,
  updateConfig,
}))

import { useConfigMap, useUpdateConfig } from "@/hooks/use-whitelabel"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useConfigMap", () => {
  beforeEach(() => vi.clearAllMocks())

  it("is in loading state initially", () => {
    fetchConfigMap.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useConfigMap(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it("fetches and returns the config map", async () => {
    const mockMap = { clinicName: "CareKit Clinic", primaryColor: "#3B82F6" }
    fetchConfigMap.mockResolvedValueOnce(mockMap)

    const { result } = renderHook(() => useConfigMap(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(mockMap)
    expect(fetchConfigMap).toHaveBeenCalledTimes(1)
  })

  it("exposes an error when the fetch fails", async () => {
    fetchConfigMap.mockRejectedValueOnce(new Error("server error"))

    const { result } = renderHook(() => useConfigMap(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe("useUpdateConfig", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls updateConfig with the provided payload", async () => {
    const payload = { key: "clinicName", value: "My Clinic" }
    updateConfig.mockResolvedValueOnce([{ key: "clinicName", value: "My Clinic" }])

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useUpdateConfig(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(updateConfig).toHaveBeenCalledWith(payload, expect.anything())
  })

  it("mutation is idle before being called", () => {
    const { result } = renderHook(() => useUpdateConfig(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.isIdle).toBe(true)
  })

  it("invalidates whitelabel queries on success", async () => {
    updateConfig.mockResolvedValueOnce([])
    fetchConfigMap.mockResolvedValue({})

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useUpdateConfig(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ key: "x", value: "y" })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["whitelabel"] }),
    )
  })
})
