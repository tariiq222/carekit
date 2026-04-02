import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPractitioners,
  fetchPractitioner,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchPractitionerServices,
  fetchPractitionerServiceTypes,
} = vi.hoisted(() => ({
  fetchPractitioners: vi.fn(),
  fetchPractitioner: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
  fetchPractitionerServices: vi.fn(),
  fetchPractitionerServiceTypes: vi.fn(),
}))

vi.mock("@/lib/api/practitioners", () => ({
  fetchPractitioners,
  fetchPractitioner,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchPractitionerServices,
  fetchPractitionerServiceTypes,
  // mutation fns — not used by query hooks but must be present for the module
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
  fetchSlots: vi.fn(),
}))

vi.mock("@/hooks/use-practitioner-mutations", () => ({
  usePractitionerMutations: vi.fn(() => ({})),
  useSetAvailability: vi.fn(() => ({})),
  useSetBreaks: vi.fn(() => ({})),
  useVacationMutations: vi.fn(() => ({})),
  usePractitionerServiceMutations: vi.fn(() => ({})),
}))

import {
  usePractitioners,
  usePractitioner,
  usePractitionerAvailability,
  usePractitionerBreaks,
  usePractitionerVacations,
  usePractitionerServices,
  usePractitionerServiceTypes,
} from "@/hooks/use-practitioners"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("usePractitioners", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches practitioners and returns items", async () => {
    const items = [{ id: "p-1", firstName: "Ali", lastName: "Hassan" }]
    fetchPractitioners.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => usePractitioners(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPractitioners).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.practitioners).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("setSearch resets page to 1 and passes search to api", async () => {
    fetchPractitioners.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePractitioners(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("Dr. Ali") })

    await waitFor(() =>
      expect(fetchPractitioners).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Dr. Ali", page: 1 }),
      ),
    )
  })
})

describe("usePractitioner", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches practitioner by id", async () => {
    const practitioner = { id: "p-1", firstName: "Ali" }
    fetchPractitioner.mockResolvedValueOnce(practitioner)

    const { result } = renderHook(() => usePractitioner("p-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPractitioner).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(practitioner)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePractitioner(null), { wrapper: makeWrapper() })

    expect(fetchPractitioner).not.toHaveBeenCalled()
  })
})

describe("usePractitionerAvailability", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches availability when id is provided", async () => {
    const availability = [{ day: "MONDAY", startTime: "09:00" }]
    fetchAvailability.mockResolvedValueOnce(availability)

    const { result } = renderHook(
      () => usePractitionerAvailability("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchAvailability).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(availability)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePractitionerAvailability(null), { wrapper: makeWrapper() })
    expect(fetchAvailability).not.toHaveBeenCalled()
  })
})

describe("usePractitionerBreaks", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches breaks when id is provided", async () => {
    fetchBreaks.mockResolvedValueOnce([{ id: "br-1" }])

    const { result } = renderHook(
      () => usePractitionerBreaks("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchBreaks).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePractitionerBreaks(null), { wrapper: makeWrapper() })
    expect(fetchBreaks).not.toHaveBeenCalled()
  })
})

describe("usePractitionerVacations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches vacations when id is provided", async () => {
    fetchVacations.mockResolvedValueOnce([{ id: "vac-1" }])

    const { result } = renderHook(
      () => usePractitionerVacations("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchVacations).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePractitionerVacations(null), { wrapper: makeWrapper() })
    expect(fetchVacations).not.toHaveBeenCalled()
  })
})

describe("usePractitionerServices", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches services when id is provided", async () => {
    fetchPractitionerServices.mockResolvedValueOnce([{ id: "svc-1" }])

    const { result } = renderHook(
      () => usePractitionerServices("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPractitionerServices).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => usePractitionerServices(null), { wrapper: makeWrapper() })
    expect(fetchPractitionerServices).not.toHaveBeenCalled()
  })
})

describe("usePractitionerServiceTypes", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches service types when both ids are provided", async () => {
    fetchPractitionerServiceTypes.mockResolvedValueOnce([{ bookingType: "IN_PERSON" }])

    const { result } = renderHook(
      () => usePractitionerServiceTypes("p-1", "svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPractitionerServiceTypes).toHaveBeenCalledWith("p-1", "svc-1")
  })

  it("does not fetch when either id is null", () => {
    renderHook(
      () => usePractitionerServiceTypes(null, "svc-1"),
      { wrapper: makeWrapper() },
    )
    expect(fetchPractitionerServiceTypes).not.toHaveBeenCalled()
  })
})
