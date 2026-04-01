import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchPractitioners,
  assignBranchPractitioners,
  removeBranchPractitioner,
} = vi.hoisted(() => ({
  fetchBranches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  deleteBranch: vi.fn(),
  fetchBranchPractitioners: vi.fn(),
  assignBranchPractitioners: vi.fn(),
  removeBranchPractitioner: vi.fn(),
}))

vi.mock("@/lib/api/branches", () => ({
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchPractitioners,
  assignBranchPractitioners,
  removeBranchPractitioner,
}))

import {
  useBranches,
  useBranchMutations,
  useBranchPractitioners,
  useBranchPractitionerMutations,
} from "@/hooks/use-branches"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useBranches", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches branches and returns items", async () => {
    const items = [{ id: "b-1", name: "Main Branch" }]
    fetchBranches.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBranches).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.branches).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchBranches.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.branches).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("Riyadh") })

    await waitFor(() =>
      expect(fetchBranches).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Riyadh", page: 1 }),
      ),
    )
  })

  it("passes isActive filter to api", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(true) })

    await waitFor(() =>
      expect(fetchBranches).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and isActive", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(false) })
    await waitFor(() => expect(result.current.isActive).toBe(false))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.isActive).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})

describe("useBranchMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createBranch", async () => {
    createBranch.mockResolvedValueOnce({ id: "b-new" })

    const { result } = renderHook(() => useBranchMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "New Branch" } as Parameters<typeof createBranch>[0])
    })

    await waitFor(() => expect(createBranch).toHaveBeenCalled())
  })

  it("updateMut calls updateBranch with id and payload", async () => {
    updateBranch.mockResolvedValueOnce({ id: "b-1" })

    const { result } = renderHook(() => useBranchMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "b-1", name: "Updated" } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateBranch).toHaveBeenCalledWith("b-1", expect.objectContaining({ name: "Updated" })))
  })

  it("deleteMut calls deleteBranch with id", async () => {
    deleteBranch.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useBranchMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("b-1") })

    await waitFor(() => expect(deleteBranch).toHaveBeenCalledWith("b-1", expect.anything()))
  })
})

describe("useBranchPractitioners", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches practitioners for a branch", async () => {
    const practitioners = [{ id: "pr-1", name: "Dr. Ali" }]
    fetchBranchPractitioners.mockResolvedValueOnce(practitioners)

    const { result } = renderHook(
      () => useBranchPractitioners("b-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchBranchPractitioners).toHaveBeenCalledWith("b-1")
    expect(result.current.data).toEqual(practitioners)
  })

  it("does not fetch when branchId is null", () => {
    renderHook(() => useBranchPractitioners(null), { wrapper: makeWrapper() })
    expect(fetchBranchPractitioners).not.toHaveBeenCalled()
  })
})

describe("useBranchPractitionerMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("assignMut calls assignBranchPractitioners with branchId and ids", async () => {
    assignBranchPractitioners.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useBranchPractitionerMutations(),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.assignMut.mutate({ branchId: "b-1", practitionerIds: ["pr-1", "pr-2"] })
    })

    await waitFor(() =>
      expect(assignBranchPractitioners).toHaveBeenCalledWith("b-1", ["pr-1", "pr-2"]),
    )
  })

  it("removeMut calls removeBranchPractitioner with branchId and practitionerId", async () => {
    removeBranchPractitioner.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useBranchPractitionerMutations(),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.removeMut.mutate({ branchId: "b-1", practitionerId: "pr-1" })
    })

    await waitFor(() =>
      expect(removeBranchPractitioner).toHaveBeenCalledWith("b-1", "pr-1"),
    )
  })
})
