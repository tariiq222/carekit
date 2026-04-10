import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  createPractitioner,
  onboardPractitioner,
  updatePractitioner,
  deletePractitioner,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updatePractitionerService,
  removePractitionerService,
} = vi.hoisted(() => ({
  createPractitioner: vi.fn(),
  onboardPractitioner: vi.fn(),
  updatePractitioner: vi.fn(),
  deletePractitioner: vi.fn(),
  setAvailability: vi.fn(),
  setBreaks: vi.fn(),
  createVacation: vi.fn(),
  deleteVacation: vi.fn(),
  assignService: vi.fn(),
  updatePractitionerService: vi.fn(),
  removePractitionerService: vi.fn(),
}))

vi.mock("@/lib/api/practitioners", () => ({
  createPractitioner,
  onboardPractitioner,
  updatePractitioner,
  deletePractitioner,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updatePractitionerService,
  removePractitionerService,
  fetchPractitioners: vi.fn(),
  fetchPractitioner: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
  fetchPractitionerServices: vi.fn(),
  fetchPractitionerServiceTypes: vi.fn(),
  fetchSlots: vi.fn(),
}))

import {
  usePractitionerMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  usePractitionerServiceMutations,
} from "@/hooks/use-practitioner-mutations"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("usePractitionerMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMutation calls createPractitioner", async () => {
    createPractitioner.mockResolvedValueOnce({ id: "p-new" })

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMutation.mutate({ firstName: "Ali" } as Parameters<typeof createPractitioner>[0])
    })

    await waitFor(() => expect(createPractitioner).toHaveBeenCalled())
  })

  it("onboardMutation calls onboardPractitioner", async () => {
    onboardPractitioner.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.onboardMutation.mutate({ email: "ali@example.com" } as Parameters<typeof onboardPractitioner>[0])
    })

    await waitFor(() =>
      expect(onboardPractitioner).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ali@example.com" }),
      ),
    )
  })

  it("updateMutation calls updatePractitioner with id and payload", async () => {
    updatePractitioner.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMutation.mutate({ id: "p-1", firstName: "Updated" } as Parameters<typeof result.current.updateMutation.mutate>[0])
    })

    await waitFor(() =>
      expect(updatePractitioner).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ firstName: "Updated" }),
      ),
    )
  })

  it("deleteMutation calls deletePractitioner with id", async () => {
    deletePractitioner.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMutation.mutate("p-1") })

    await waitFor(() =>
      expect(deletePractitioner).toHaveBeenCalledWith("p-1", expect.anything()),
    )
  })
})

describe("useSetAvailability", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setAvailability with id and payload", async () => {
    setAvailability.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSetAvailability(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        id: "p-1",
        schedule: [],
      } as Parameters<typeof result.current.mutate>[0])
    })

    await waitFor(() =>
      expect(setAvailability).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ schedule: [] }),
      ),
    )
  })
})

describe("useSetBreaks", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setBreaks with id and payload", async () => {
    setBreaks.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSetBreaks(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        id: "p-1",
        breaks: [],
      } as Parameters<typeof result.current.mutate>[0])
    })

    await waitFor(() =>
      expect(setBreaks).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ breaks: [] }),
      ),
    )
  })
})

describe("useVacationMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createVacation with practitionerId and payload", async () => {
    createVacation.mockResolvedValueOnce({ id: "vac-new" })

    const { result } = renderHook(
      () => useVacationMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.createMut.mutate({
        startDate: "2026-04-01",
        endDate: "2026-04-07",
      } as Parameters<typeof createVacation>[1])
    })

    await waitFor(() =>
      expect(createVacation).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ startDate: "2026-04-01" }),
      ),
    )
  })

  it("deleteMut calls deleteVacation with practitionerId and vacationId", async () => {
    deleteVacation.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useVacationMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => { result.current.deleteMut.mutate("vac-1") })

    await waitFor(() =>
      expect(deleteVacation).toHaveBeenCalledWith("p-1", "vac-1"),
    )
  })
})

describe("usePractitionerServiceMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("assignMut calls assignService with practitionerId and payload", async () => {
    assignService.mockResolvedValueOnce({ id: "ps-new" })

    const { result } = renderHook(
      () => usePractitionerServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.assignMut.mutate({
        serviceId: "svc-1",
      } as Parameters<typeof assignService>[1])
    })

    await waitFor(() =>
      expect(assignService).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ serviceId: "svc-1" }),
      ),
    )
  })

  it("removeMut calls removePractitionerService with practitionerId and serviceId", async () => {
    removePractitionerService.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => usePractitionerServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => { result.current.removeMut.mutate("svc-1") })

    await waitFor(() =>
      expect(removePractitionerService).toHaveBeenCalledWith("p-1", "svc-1"),
    )
  })

  it("updateMut calls updatePractitionerService with practitionerId, serviceId, payload", async () => {
    updatePractitionerService.mockResolvedValueOnce({ id: "ps-1" })

    const { result } = renderHook(
      () => usePractitionerServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.updateMut.mutate({
        serviceId: "svc-1",
        payload: { customDuration: 30 },
      })
    })

    await waitFor(() =>
      expect(updatePractitionerService).toHaveBeenCalledWith(
        "p-1",
        "svc-1",
        expect.objectContaining({ customDuration: 30 }),
      ),
    )
  })
})

describe("usePractitionerMutations error handling", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMutation propagates error", async () => {
    createPractitioner.mockRejectedValueOnce(new Error("Email already exists"))

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMutation.mutate({ email: "dup@clinic.com" } as Parameters<typeof createPractitioner>[0])
    })

    await waitFor(() => expect(result.current.createMutation.isError).toBe(true))
    expect(result.current.createMutation.error?.message).toBe("Email already exists")
  })

  it("deleteMutation propagates error", async () => {
    deletePractitioner.mockRejectedValueOnce(new Error("Has active bookings"))

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMutation.mutate("p-1") })

    await waitFor(() => expect(result.current.deleteMutation.isError).toBe(true))
    expect(result.current.deleteMutation.error?.message).toBe("Has active bookings")
  })

  it("onboardMutation resolves successfully", async () => {
    onboardPractitioner.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => usePractitionerMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.onboardMutation.mutate({ email: "new@clinic.com" } as Parameters<typeof onboardPractitioner>[0])
    })

    await waitFor(() => expect(result.current.onboardMutation.isSuccess).toBe(true))
  })
})
