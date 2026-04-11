import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchWaitlist, removeWaitlistEntry } = vi.hoisted(() => ({
  fetchWaitlist: vi.fn(),
  removeWaitlistEntry: vi.fn(),
}))

vi.mock("@/lib/api/waitlist", () => ({
  fetchWaitlist,
  removeWaitlistEntry,
}))

import { useWaitlist, useWaitlistMutations } from "@/hooks/use-waitlist"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useWaitlist", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty entries while loading", () => {
    fetchWaitlist.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useWaitlist(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.entries).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it("fetches and returns waitlist entries", async () => {
    const mockEntries = [{ id: "wl-1", patientId: "p-1" }]
    fetchWaitlist.mockResolvedValueOnce(mockEntries)

    const { result } = renderHook(() => useWaitlist(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.entries).toEqual(mockEntries)
    expect(result.current.error).toBeNull()
  })

  it("calls fetchWaitlist with practitionerId filter when set", async () => {
    fetchWaitlist.mockResolvedValue([])

    const { result } = renderHook(() => useWaitlist(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setPractitionerId("prac-1")
    })

    await waitFor(() =>
      expect(fetchWaitlist).toHaveBeenCalledWith(
        expect.objectContaining({ practitionerId: "prac-1" }),
      ),
    )
  })

  it("resetFilters clears practitionerId and status", async () => {
    fetchWaitlist.mockResolvedValue([])

    const { result } = renderHook(() => useWaitlist(), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.setPractitionerId("prac-1")
      result.current.setStatus("WAITING" as Parameters<typeof result.current.setStatus>[0])
    })

    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.practitionerId).toBeUndefined()
    expect(result.current.status).toBeUndefined()
  })

  it("surfaces error message on fetch failure", async () => {
    fetchWaitlist.mockRejectedValueOnce(new Error("timeout"))

    const { result } = renderHook(() => useWaitlist(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBe("timeout"))
  })
})

describe("useWaitlistMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("removeMut calls removeWaitlistEntry with the given id", async () => {
    removeWaitlistEntry.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useWaitlistMutations(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.removeMut.mutateAsync("wl-42")
    })

    expect(removeWaitlistEntry).toHaveBeenCalledWith("wl-42", expect.anything())
  })

  it("removeMut is idle before being called", () => {
    const { result } = renderHook(() => useWaitlistMutations(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.removeMut.isPending).toBe(false)
  })

  it("invalidates waitlist queries after successful removal", async () => {
    removeWaitlistEntry.mockResolvedValueOnce(undefined)
    fetchWaitlist.mockResolvedValue([])

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useWaitlistMutations(), { wrapper })

    await act(async () => {
      await result.current.removeMut.mutateAsync("wl-1")
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["waitlist"] }),
    )
  })
})
