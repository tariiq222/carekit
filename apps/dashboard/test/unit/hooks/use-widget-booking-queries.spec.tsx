import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchWidgetEmployees,
  fetchWidgetEmployeeServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  fetchPublicBranches,
  fetchWidgetAvailableDates,
} = vi.hoisted(() => ({
  fetchWidgetEmployees: vi.fn(),
  fetchWidgetEmployeeServices: vi.fn(),
  fetchWidgetSlots: vi.fn(),
  fetchWidgetServiceTypes: vi.fn(),
  fetchWidgetServices: vi.fn(),
  fetchPublicBranches: vi.fn(),
  fetchWidgetAvailableDates: vi.fn(),
}))

vi.mock("@/lib/api/widget", () => ({
  fetchWidgetEmployees,
  fetchWidgetEmployeeServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  fetchPublicBranches,
  fetchWidgetAvailableDates,
}))

import {
  useWidgetBookingQueries,
  useWidgetSlotsQuery,
  useWidgetAvailableDatesQuery,
} from "@/hooks/use-widget-booking-queries"

const emptyState = {
  step: "service" as const,
  employee: null,
  service: null,
  bookingType: null,
  durationOption: null,
  date: "",
  slot: null,
  booking: null,
  branch: null,
  couponCode: null,
  couponId: null,
  discountAmount: 0,
  paymentMethod: null,
  showIntakePopup: false,
}

describe("useWidgetBookingQueries", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches branches always", async () => {
    fetchPublicBranches.mockResolvedValueOnce([{ id: "b1", nameAr: "فرع", nameEn: "Branch", address: null, phone: null }])

    const { result } = renderHook(
      () => useWidgetBookingQueries(emptyState, "employee_first"),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.branches.length).toBeGreaterThan(0))
    expect(fetchPublicBranches).toHaveBeenCalled()
  })

  it("fetches employees when flowOrder is employee_first", async () => {
    fetchWidgetEmployees.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    fetchPublicBranches.mockResolvedValueOnce([])

    renderHook(
      () => useWidgetBookingQueries(emptyState, "employee_first"),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(fetchWidgetEmployees).toHaveBeenCalledWith({ perPage: 20 }))
  })

  it("fetches services when flowOrder is service_first", async () => {
    fetchWidgetServices.mockResolvedValueOnce({ items: [{ id: "s1" }], meta: { total: 1 } })
    fetchPublicBranches.mockResolvedValueOnce([])

    renderHook(
      () => useWidgetBookingQueries(emptyState, "service_first"),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(fetchWidgetServices).toHaveBeenCalled())
  })
})

describe("useWidgetSlotsQuery", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches slots when canFetchSlots is true", async () => {
    fetchWidgetSlots.mockResolvedValueOnce([{ start: "10:00", end: "10:30" }])

    const stateWithEmployee = { ...emptyState, employee: { id: "p1" } as never, date: "2026-01-01" }

    const { result } = renderHook(
      () => useWidgetSlotsQuery(stateWithEmployee, true, 30),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0))
    expect(fetchWidgetSlots).toHaveBeenCalledWith("p1", "2026-01-01", 30)
  })

  it("does not fetch slots when canFetchSlots is false", async () => {
    fetchWidgetSlots.mockResolvedValueOnce([])

    const stateWithEmployee = { ...emptyState, employee: { id: "p1" } as never, date: "2026-01-01" }

    renderHook(
      () => useWidgetSlotsQuery(stateWithEmployee, false, 30),
      { wrapper: createWrapper() },
    )

    expect(fetchWidgetSlots).not.toHaveBeenCalled()
  })
})

describe("useWidgetAvailableDatesQuery", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches available dates when employeeId and month provided", async () => {
    fetchWidgetAvailableDates.mockResolvedValueOnce(["2026-01-01", "2026-01-02"])

    const { result } = renderHook(
      () => useWidgetAvailableDatesQuery("p1", "2026-01", 30),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.availableDates.length).toBeGreaterThan(0))
    expect(fetchWidgetAvailableDates).toHaveBeenCalledWith("p1", "2026-01", 30, undefined)
  })

  it("does not fetch when employeeId is undefined", () => {
    fetchWidgetAvailableDates.mockResolvedValueOnce([])

    renderHook(
      () => useWidgetAvailableDatesQuery(undefined, "2026-01", 30),
      { wrapper: createWrapper() },
    )

    expect(fetchWidgetAvailableDates).not.toHaveBeenCalled()
  })
})
