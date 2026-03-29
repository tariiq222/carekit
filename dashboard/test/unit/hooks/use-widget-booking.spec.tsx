import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  widgetCreateBooking,
} = vi.hoisted(() => ({
  fetchWidgetPractitioners: vi.fn(),
  fetchWidgetPractitionerServices: vi.fn(),
  fetchWidgetSlots: vi.fn(),
  fetchWidgetServiceTypes: vi.fn(),
  widgetCreateBooking: vi.fn(),
}))

vi.mock("@/lib/api/widget", () => ({
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  widgetCreateBooking,
}))

import { useWidgetBooking } from "@/hooks/use-widget-booking"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const mockPractitioner = {
  id: "p-1",
  firstName: "Ali",
  lastName: "Hassan",
  specialties: [],
}

const mockService = {
  id: "svc-1",
  name: "Consultation",
  categoryId: "cat-1",
  isActive: true,
  isHidden: false,
}

const mockSlot = { startTime: "09:00", endTime: "09:30" }

describe("useWidgetBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWidgetPractitioners.mockResolvedValue({ items: [], meta: { total: 0 } })
    fetchWidgetPractitionerServices.mockResolvedValue([])
    fetchWidgetServiceTypes.mockResolvedValue([])
    fetchWidgetSlots.mockResolvedValue([])
  })

  it('initial state has step = "service"', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    expect(result.current.state.step).toBe("service")
    expect(result.current.state.practitioner).toBeNull()
    expect(result.current.state.service).toBeNull()
    expect(result.current.state.slot).toBeNull()
  })

  it('selectService sets service and moves to "datetime" step', async () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0])
    })

    act(() => {
      result.current.selectService(
        mockService as Parameters<typeof result.current.selectService>[0],
        "IN_PERSON",
      )
    })

    expect(result.current.state.service?.id).toBe("svc-1")
    expect(result.current.state.bookingType).toBe("IN_PERSON")
    expect(result.current.state.step).toBe("datetime")
  })

  it('selectPractitioner sets practitioner and resets service/slot', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0])
    })

    expect(result.current.state.practitioner?.id).toBe("p-1")
    expect(result.current.state.service).toBeNull()
    expect(result.current.state.slot).toBeNull()
  })

  it('selectDateTime sets date and slot and moves to "auth" step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0])
    })

    act(() => {
      result.current.selectService(
        mockService as Parameters<typeof result.current.selectService>[0],
        "IN_PERSON",
      )
    })

    act(() => {
      result.current.selectDateTime("2026-04-01", mockSlot as Parameters<typeof result.current.selectDateTime>[1])
    })

    expect(result.current.state.date).toBe("2026-04-01")
    expect(result.current.state.slot?.startTime).toBe("09:00")
    expect(result.current.state.step).toBe("auth")
  })

  it('onAuthComplete moves to "confirm" step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0])
    })

    act(() => {
      result.current.selectService(
        mockService as Parameters<typeof result.current.selectService>[0],
        "IN_PERSON",
      )
    })

    act(() => {
      result.current.selectDateTime("2026-04-01", mockSlot as Parameters<typeof result.current.selectDateTime>[1])
    })

    act(() => { result.current.onAuthComplete() })

    expect(result.current.state.step).toBe("confirm")
  })

  it("confirmBooking mutation calls widgetCreateBooking with correct payload", async () => {
    const booking = { id: "bk-1" }
    widgetCreateBooking.mockResolvedValueOnce(booking)

    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.setState((s) => ({
        ...s,
        practitioner: mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0],
        service: mockService as Parameters<typeof result.current.selectService>[0],
        bookingType: "IN_PERSON",
        date: "2026-04-01",
        slot: mockSlot as Parameters<typeof result.current.selectDateTime>[1],
        step: "confirm",
      }))
    })

    act(() => { result.current.confirmBooking() })

    await waitFor(() =>
      expect(widgetCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          practitionerId: "p-1",
          serviceId: "svc-1",
          type: "IN_PERSON",
          date: "2026-04-01",
          startTime: "09:00",
        }),
        expect.anything(),
      ),
    )
  })

  it('goBack() moves to the previous step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0])
    })

    act(() => {
      result.current.selectService(
        mockService as Parameters<typeof result.current.selectService>[0],
        "IN_PERSON",
      )
    })

    // step is now "datetime"
    expect(result.current.state.step).toBe("datetime")

    act(() => { result.current.goBack() })

    expect(result.current.state.step).toBe("service")
  })

  it('goBack() on "service" step does nothing', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    // already at "service"
    act(() => { result.current.goBack() })

    expect(result.current.state.step).toBe("service")
  })

  it("confirmBooking does nothing when required state is missing", () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => { result.current.confirmBooking() })

    expect(widgetCreateBooking).not.toHaveBeenCalled()
  })

  it("success step is set after confirmBooking resolves", async () => {
    widgetCreateBooking.mockResolvedValueOnce({ id: "bk-new" })

    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.setState((s) => ({
        ...s,
        practitioner: mockPractitioner as Parameters<typeof result.current.selectPractitioner>[0],
        service: mockService as Parameters<typeof result.current.selectService>[0],
        bookingType: "IN_PERSON",
        date: "2026-04-01",
        slot: mockSlot as Parameters<typeof result.current.selectDateTime>[1],
        step: "confirm",
      }))
    })

    act(() => { result.current.confirmBooking() })

    await waitFor(() => expect(result.current.state.step).toBe("success"))
    expect(result.current.state.booking).toEqual({ id: "bk-new" })
  })
})
