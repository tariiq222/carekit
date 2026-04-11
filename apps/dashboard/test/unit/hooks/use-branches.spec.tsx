import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchEmployees,
  assignBranchEmployees,
  removeBranchEmployee,
} = vi.hoisted(() => ({
  fetchBranches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  deleteBranch: vi.fn(),
  fetchBranchEmployees: vi.fn(),
  assignBranchEmployees: vi.fn(),
  removeBranchEmployee: vi.fn(),
}))

vi.mock("@/lib/api/branches", () => ({
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchEmployees,
  assignBranchEmployees,
  removeBranchEmployee,
}))

import {
  useBranches,
  useBranchMutations,
  useBranchEmployees,
  useBranchEmployeeMutations,
} from "@/hooks/use-branches"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
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

describe("useBranchEmployees", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches employees for a branch", async () => {
    const employees = [{ id: "pr-1", name: "Dr. Ali" }]
    fetchBranchEmployees.mockResolvedValueOnce(employees)

    const { result } = renderHook(
      () => useBranchEmployees("b-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchBranchEmployees).toHaveBeenCalledWith("b-1")
    expect(result.current.data).toEqual(employees)
  })

  it("does not fetch when branchId is null", () => {
    renderHook(() => useBranchEmployees(null), { wrapper: makeWrapper() })
    expect(fetchBranchEmployees).not.toHaveBeenCalled()
  })
})

describe("useBranchEmployeeMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("assignMut calls assignBranchEmployees with branchId and ids", async () => {
    assignBranchEmployees.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useBranchEmployeeMutations(),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.assignMut.mutate({ branchId: "b-1", employeeIds: ["pr-1", "pr-2"] })
    })

    await waitFor(() =>
      expect(assignBranchEmployees).toHaveBeenCalledWith("b-1", ["pr-1", "pr-2"]),
    )
  })

  it("removeMut calls removeBranchEmployee with branchId and employeeId", async () => {
    removeBranchEmployee.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useBranchEmployeeMutations(),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.removeMut.mutate({ branchId: "b-1", employeeId: "pr-1" })
    })

    await waitFor(() =>
      expect(removeBranchEmployee).toHaveBeenCalledWith("b-1", "pr-1"),
    )
  })
})
