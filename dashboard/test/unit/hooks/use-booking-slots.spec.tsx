import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchSlots, fetchPractitionerServiceTypes, fetchPractitionerServices } = vi.hoisted(() => ({
  fetchSlots: vi.fn(),
  fetchPractitionerServiceTypes: vi.fn(),
  fetchPractitionerServices: vi.fn(),
}))

vi.mock("@/lib/api/practitioners-schedule", () => ({
  fetchSlots,
  fetchPractitionerServiceTypes,
  fetchPractitionerServices,
}))

import { useCreateBookingSlots } from "@/components/features/bookings/use-booking-slots"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const baseOpts = {
  practitionerId: "p-1",
  serviceId: "svc-1",
  bookingType: "in_person",
  date: "2026-03-27",
  durationOptionId: "",
}

const mockPractitionerServices = [
  {
    id: "ps1",
    serviceId: "svc-1",
    customDuration: null,
    bufferMinutes: 0,
    availableTypes: ["in_person"],
    isActive: true,
    service: { id: "svc-1", nameAr: "استشارة عامة", nameEn: "General", price: 200, duration: 30 },
  },
]

describe("useCreateBookingSlots", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches practitioner services when practitionerId is provided", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.practitionerServicesLoading).toBe(false))

    expect(fetchPractitionerServices).toHaveBeenCalledWith("p-1")
    expect(result.current.practitionerServices).toEqual(mockPractitionerServices)
  })

  it("does not fetch practitioner services when practitionerId is empty", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, practitionerId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchPractitionerServices).not.toHaveBeenCalled()
  })

  it("fetches service types when practitionerId and serviceId are provided", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(fetchPractitionerServiceTypes).toHaveBeenCalledWith("p-1", "svc-1")
    expect(result.current.canFetchServiceTypes).toBe(true)
  })

  it("does not fetch service types when practitionerId is missing", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, practitionerId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchPractitionerServiceTypes).not.toHaveBeenCalled()
  })

  it("does not fetch service types when serviceId is missing", () => {
    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, serviceId: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchPractitionerServiceTypes).not.toHaveBeenCalled()
  })

  it("fetches slots when practitionerId and date are provided with no duration options", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:30" }])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", undefined)
    expect(result.current.slots).toHaveLength(1)
  })

  it("does not fetch slots when date is missing", () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([])

    renderHook(
      () => useCreateBookingSlots({ ...baseOpts, date: "" }),
      { wrapper: makeWrapper() },
    )

    expect(fetchSlots).not.toHaveBeenCalled()
  })

  it("returns duration options from matching active service type", async () => {
    const durationOptions = [{ id: "d-1", durationMinutes: 30, label: "30m", labelAr: "٣٠", price: null, isDefault: true, sortOrder: 0 }]
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "d-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.durationOptions).toEqual(durationOptions)
    expect(result.current.hasDurationOptions).toBe(true)
    expect(result.current.selectedDuration).toBe(30)
  })

  it("returns empty duration options for inactive service type", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: false, durationOptions: [{ id: "d-1", durationMinutes: 30 }] },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(false)
    expect(result.current.durationOptions).toHaveLength(0)
  })

  it("returns empty duration options when bookingType has no matching service type", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions: [] },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, bookingType: "online" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(false)
  })

  it("blocks slot fetching when duration options exist but none selected", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([
      {
        bookingType: "in_person",
        isActive: true,
        durationOptions: [{ id: "d-1", durationMinutes: 30 }],
      },
    ])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.hasDurationOptions).toBe(true)
    expect(result.current.canFetchSlots).toBe(false)
  })

  it("fetches slots with correct duration when option is selected", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([
      { bookingType: "in_person", isActive: true, durationOptions: [{ id: "d-1", durationMinutes: 45 }] },
    ])
    fetchSlots.mockResolvedValue([{ startTime: "09:00", endTime: "09:45" }])

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, durationOptionId: "d-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    expect(fetchSlots).toHaveBeenCalledWith("p-1", "2026-03-27", 45)
    expect(result.current.canFetchSlots).toBe(true)
  })

  it("handles fetchPractitionerServiceTypes error gracefully — returns empty types", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }))

    const { result } = renderHook(
      () => useCreateBookingSlots({ ...baseOpts, serviceId: "unassigned-svc" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.serviceTypesLoading).toBe(false))

    expect(result.current.durationOptions).toEqual([])
    expect(result.current.hasDurationOptions).toBe(false)
  })

  it("uses act to verify state stabilizes", async () => {
    fetchPractitionerServices.mockResolvedValue(mockPractitionerServices)
    fetchPractitionerServiceTypes.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])

    const { result } = renderHook(() => useCreateBookingSlots(baseOpts), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.slotsLoading).toBe(false))

    act(() => { /* state stabilized */ })

    expect(result.current.slots).toEqual([])
  })
})
