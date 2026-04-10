import { renderHook, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchGroupSessions,
  fetchGroupSession,
} = vi.hoisted(() => ({
  fetchGroupSessions: vi.fn(),
  fetchGroupSession: vi.fn(),
}))

vi.mock("@/lib/api/group-sessions", () => ({
  fetchGroupSessions,
  fetchGroupSession,
}))

import { useGroupSessions, useGroupSessionDetail } from "@/hooks/use-group-sessions"

describe("useGroupSessions", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches sessions and returns items", async () => {
    const items = [{ id: "gs-1", name: "Yoga Class" }]
    fetchGroupSessions.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useGroupSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchGroupSessions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.sessions).toEqual(items)
  })

  it("returns loading state initially", () => {
    fetchGroupSessions.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useGroupSessions(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.sessions).toEqual([])
  })

  it("passes search and resets page", async () => {
    fetchGroupSessions.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGroupSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("yoga") })

    await waitFor(() =>
      expect(fetchGroupSessions).toHaveBeenCalledWith(
        expect.objectContaining({ search: "yoga", page: 1 }),
      ),
    )
  })

  it("passes status filter", async () => {
    fetchGroupSessions.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGroupSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("completed" as never) })

    await waitFor(() =>
      expect(fetchGroupSessions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      ),
    )
  })

  it("resetFilters clears all filters", async () => {
    fetchGroupSessions.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGroupSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("test") })
    act(() => { result.current.setPractitionerId("pr-1") })

    act(() => { result.current.resetFilters() })

    expect(result.current.search).toBe("")
    expect(result.current.practitionerId).toBeUndefined()
    expect(result.current.status).toBeUndefined()
    expect(result.current.visibility).toBeUndefined()
    expect(result.current.page).toBe(1)
  })
})

describe("useGroupSessionDetail", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches session detail by id", async () => {
    const session = { id: "gs-1", name: "Yoga Class" }
    fetchGroupSession.mockResolvedValueOnce(session)

    const { result } = renderHook(() => useGroupSessionDetail("gs-1"), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchGroupSession).toHaveBeenCalledWith("gs-1")
    expect(result.current.data).toEqual(session)
  })

  it("does not fetch when id is empty", () => {
    renderHook(() => useGroupSessionDetail(""), { wrapper: createWrapper() })
    expect(fetchGroupSession).not.toHaveBeenCalled()
  })
})
