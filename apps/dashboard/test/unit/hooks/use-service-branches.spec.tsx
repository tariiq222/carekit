import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchServiceEmployees,
  assignService,
  setServiceBranches,
  clearServiceBranches,
} = vi.hoisted(() => ({
  fetchServiceEmployees: vi.fn(),
  assignService: vi.fn(),
  setServiceBranches: vi.fn(),
  clearServiceBranches: vi.fn(),
}))

vi.mock("@/lib/api/services", () => ({
  fetchServices: vi.fn(),
  fetchCategories: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  fetchDurationOptions: vi.fn(),
  setDurationOptions: vi.fn(),
  fetchServiceBookingTypes: vi.fn(),
  setServiceBookingTypes: vi.fn(),
  fetchIntakeForms: vi.fn(),
  createIntakeForm: vi.fn(),
  updateIntakeForm: vi.fn(),
  deleteIntakeForm: vi.fn(),
  setIntakeFields: vi.fn(),
  fetchServiceEmployees,
  setServiceBranches,
  clearServiceBranches,
}))

vi.mock("@/lib/api/employees", () => ({
  assignService,
}))

import {
  useServiceEmployees,
  useAssignEmployeesToService,
  useSetServiceBranches,
  useClearServiceBranches,
} from "@/hooks/use-services"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useServiceEmployees", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches employees for a service", async () => {
    const employees = [{ id: "p-1", name: "Dr. Ali" }]
    fetchServiceEmployees.mockResolvedValueOnce(employees)

    const { result } = renderHook(
      () => useServiceEmployees("svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServiceEmployees).toHaveBeenCalledWith("svc-1")
    expect(result.current.data).toEqual(employees)
  })

  it("does not fetch when serviceId is empty", () => {
    renderHook(
      () => useServiceEmployees(""),
      { wrapper: makeWrapper() },
    )

    expect(fetchServiceEmployees).not.toHaveBeenCalled()
  })
})

describe("useAssignEmployeesToService", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls assignService for each employee id", async () => {
    assignService.mockResolvedValue({})

    const { result } = renderHook(
      () => useAssignEmployeesToService("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate(["p-1", "p-2"])
    })

    await waitFor(() => expect(assignService).toHaveBeenCalledTimes(2))

    expect(assignService).toHaveBeenCalledWith("p-1", expect.objectContaining({
      serviceId: "svc-1",
      isActive: true,
    }))
    expect(assignService).toHaveBeenCalledWith("p-2", expect.objectContaining({
      serviceId: "svc-1",
      isActive: true,
    }))
  })

  it("calls assignService with empty array when no employees", async () => {
    const { result } = renderHook(
      () => useAssignEmployeesToService("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate([])
    })

    await waitFor(() => expect(assignService).not.toHaveBeenCalled())
  })
})

describe("useSetServiceBranches", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setServiceBranches with payload", async () => {
    setServiceBranches.mockResolvedValueOnce({ updated: true })

    const { result } = renderHook(
      () => useSetServiceBranches("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate({ branchIds: ["br-1", "br-2"] })
    })

    await waitFor(() =>
      expect(setServiceBranches).toHaveBeenCalledWith(
        "svc-1",
        { branchIds: ["br-1", "br-2"] },
      ),
    )
  })
})

describe("useClearServiceBranches", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls clearServiceBranches", async () => {
    clearServiceBranches.mockResolvedValueOnce({ cleared: true })

    const { result } = renderHook(
      () => useClearServiceBranches("svc-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate()
    })

    await waitFor(() =>
      expect(clearServiceBranches).toHaveBeenCalledWith("svc-1"),
    )
  })
})
