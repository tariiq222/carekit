import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchServicePractitioners,
  assignService,
  setServiceBranches,
  clearServiceBranches,
} = vi.hoisted(() => ({
  fetchServicePractitioners: vi.fn(),
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
  fetchServicePractitioners,
  setServiceBranches,
  clearServiceBranches,
}))

vi.mock("@/lib/api/practitioners", () => ({
  assignService,
}))

import {
  useServicePractitioners,
  useAssignPractitionersToService,
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

describe("useServicePractitioners", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches practitioners for a service", async () => {
    const practitioners = [{ id: "p-1", name: "Dr. Ali" }]
    fetchServicePractitioners.mockResolvedValueOnce(practitioners)

    const { result } = renderHook(
      () => useServicePractitioners("svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchServicePractitioners).toHaveBeenCalledWith("svc-1")
    expect(result.current.data).toEqual(practitioners)
  })

  it("does not fetch when serviceId is empty", () => {
    renderHook(
      () => useServicePractitioners(""),
      { wrapper: makeWrapper() },
    )

    expect(fetchServicePractitioners).not.toHaveBeenCalled()
  })
})

describe("useAssignPractitionersToService", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls assignService for each practitioner id", async () => {
    assignService.mockResolvedValue({})

    const { result } = renderHook(
      () => useAssignPractitionersToService("svc-1"),
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

  it("calls assignService with empty array when no practitioners", async () => {
    const { result } = renderHook(
      () => useAssignPractitionersToService("svc-1"),
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
