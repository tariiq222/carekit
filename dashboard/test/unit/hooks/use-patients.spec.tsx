import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPatients,
  fetchPatient,
  fetchPatientStats,
  updatePatient,
  createWalkInPatient,
  activatePatient,
  deactivatePatient,
} = vi.hoisted(() => ({
  fetchPatients: vi.fn(),
  fetchPatient: vi.fn(),
  fetchPatientStats: vi.fn(),
  updatePatient: vi.fn(),
  createWalkInPatient: vi.fn(),
  activatePatient: vi.fn(),
  deactivatePatient: vi.fn(),
}))

vi.mock("@/lib/api/patients", () => ({
  fetchPatients,
  fetchPatient,
  fetchPatientStats,
  updatePatient,
  createWalkInPatient,
  activatePatient,
  deactivatePatient,
}))

import {
  usePatients,
  usePatient,
  usePatientStats,
  usePatientMutations,
  useInvalidatePatients,
} from "@/hooks/use-patients"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("usePatients", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches patients and returns items", async () => {
    const items = [{ id: "p-1", name: "Ahmed" }]
    fetchPatients.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPatients).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.patients).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchPatients.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.patients).toEqual([])
  })

  it("returns empty patients when api returns no items", async () => {
    fetchPatients.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.patients).toEqual([])
  })

  it("passes search filter to api and resets page", async () => {
    fetchPatients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("sara") })

    await waitFor(() =>
      expect(fetchPatients).toHaveBeenCalledWith(
        expect.objectContaining({ search: "sara", page: 1 }),
      ),
    )
    expect(result.current.page).toBe(1)
  })

  it("resetSearch clears search and resets page", async () => {
    fetchPatients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("test") })
    await waitFor(() => expect(result.current.search).toBe("test"))

    act(() => { result.current.resetSearch() })
    await waitFor(() => expect(result.current.search).toBe(""))
    expect(result.current.page).toBe(1)
  })
})

describe("usePatient", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches a single patient by id", async () => {
    const patient = { id: "p-1", name: "Ahmed" }
    fetchPatient.mockResolvedValueOnce(patient)

    const { result } = renderHook(() => usePatient("p-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPatient).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(patient)
  })

  it("does not fetch when id is null", () => {
    const { result } = renderHook(() => usePatient(null), { wrapper: makeWrapper() })

    expect(fetchPatient).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
  })
})

describe("usePatientStats", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches stats for a given patient id", async () => {
    const stats = { totalBookings: 5, totalSpend: 1500 }
    fetchPatientStats.mockResolvedValueOnce(stats)

    const { result } = renderHook(() => usePatientStats("p-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPatientStats).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(stats)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePatientStats(null), { wrapper: makeWrapper() })
    expect(fetchPatientStats).not.toHaveBeenCalled()
  })
})

describe("usePatientMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createWalkInPatient", async () => {
    createWalkInPatient.mockResolvedValueOnce({ id: "p-new" })
    fetchPatients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePatientMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "Walk-in" } as Parameters<typeof createWalkInPatient>[0])
    })

    await waitFor(() => expect(createWalkInPatient).toHaveBeenCalled())
  })

  it("updateMut calls updatePatient with id and payload", async () => {
    updatePatient.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePatientMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "p-1", payload: { name: "Updated" } } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith("p-1", expect.objectContaining({ name: "Updated" })))
  })

  it("activateMut calls activatePatient", async () => {
    activatePatient.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePatientMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.activateMut.mutate("p-1") })

    await waitFor(() => expect(activatePatient).toHaveBeenCalledWith("p-1", expect.anything()))
  })

  it("deactivateMut calls deactivatePatient", async () => {
    deactivatePatient.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePatientMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deactivateMut.mutate("p-1") })

    await waitFor(() => expect(deactivatePatient).toHaveBeenCalledWith("p-1", expect.anything()))
  })
})

describe("useInvalidatePatients", () => {
  it("returns a callable invalidation function", () => {
    const { result } = renderHook(() => useInvalidatePatients(), { wrapper: makeWrapper() })
    expect(typeof result.current).toBe("function")
  })
})
