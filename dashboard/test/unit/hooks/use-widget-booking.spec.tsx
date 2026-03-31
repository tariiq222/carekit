import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  widgetCreateBooking,
} = vi.hoisted(() => ({
  fetchWidgetPractitioners: vi.fn(),
  fetchWidgetPractitionerServices: vi.fn(),
  fetchWidgetSlots: vi.fn(),
  fetchWidgetServiceTypes: vi.fn(),
  fetchWidgetServices: vi.fn(),
  widgetCreateBooking: vi.fn(),
}))

vi.mock("@/lib/api/widget", () => ({
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  widgetCreateBooking,
}))

import { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { WizardState } from "@/hooks/use-widget-booking"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Minimal valid-shape mocks (cast to avoid requiring every field)
const mockPractitioner = { id: "p-1", user: { firstName: "Ali", lastName: "Hassan" } } as WizardState["practitioner"]
const mockService = { id: "svc-1", nameAr: "استشارة", nameEn: "Consultation", isActive: true } as WizardState["service"]
const mockSlot = { startTime: "09:00", endTime: "09:30" } as WizardState["slot"]

describe("useWidgetBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWidgetPractitioners.mockResolvedValue({ items: [], meta: { total: 0 } })
    fetchWidgetPractitionerServices.mockResolvedValue([])
    fetchWidgetServiceTypes.mockResolvedValue([])
    fetchWidgetSlots.mockResolvedValue([])
    fetchWidgetServices.mockResolvedValue({ items: [], meta: { total: 0 } })
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
      result.current.selectPractitioner(mockPractitioner!)
    })

    act(() => {
      result.current.selectService(mockService!, "in_person")
    })

    expect(result.current.state.service?.id).toBe("svc-1")
    expect(result.current.state.bookingType).toBe("in_person")
    expect(result.current.state.step).toBe("datetime")
  })

  it('selectPractitioner sets practitioner and resets service/slot', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner!)
    })

    expect(result.current.state.practitioner?.id).toBe("p-1")
    expect(result.current.state.service).toBeNull()
    expect(result.current.state.slot).toBeNull()
  })

  it('selectDateTime sets date and slot and moves to "auth" step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.selectPractitioner(mockPractitioner!)
    })

    act(() => {
      result.current.selectService(mockService!, "in_person")
    })

    act(() => {
      result.current.selectDateTime("2026-04-01", mockSlot!)
    })

    expect(result.current.state.date).toBe("2026-04-01")
    expect(result.current.state.slot?.startTime).toBe("09:00")
    expect(result.current.state.step).toBe("auth")
  })

  it('onAuthComplete moves to "confirm" step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => { result.current.selectPractitioner(mockPractitioner!) })
    act(() => { result.current.selectService(mockService!, "in_person") })
    act(() => { result.current.selectDateTime("2026-04-01", mockSlot!) })
    act(() => { result.current.onAuthComplete() })

    expect(result.current.state.step).toBe("confirm")
  })

  it("confirmBooking mutation calls widgetCreateBooking with correct payload", async () => {
    const booking = { id: "bk-1" }
    widgetCreateBooking.mockResolvedValueOnce(booking)

    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => {
      result.current.setState((s: WizardState) => ({
        ...s,
        practitioner: mockPractitioner,
        service: mockService,
        bookingType: "in_person",
        date: "2026-04-01",
        slot: mockSlot,
        step: "confirm",
      }))
    })

    act(() => { result.current.confirmBooking() })

    await waitFor(() =>
      expect(widgetCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          practitionerId: "p-1",
          serviceId: "svc-1",
          type: "in_person",
          date: "2026-04-01",
          startTime: "09:00",
        }),
        expect.anything(),
      ),
    )
  })

  it('goBack() moves to the previous step', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

    act(() => { result.current.selectPractitioner(mockPractitioner!) })
    act(() => { result.current.selectService(mockService!, "in_person") })

    expect(result.current.state.step).toBe("datetime")

    act(() => { result.current.goBack() })

    expect(result.current.state.step).toBe("service")
  })

  it('goBack() on "service" step does nothing', () => {
    const { result } = renderHook(() => useWidgetBooking(), { wrapper: makeWrapper() })

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
      result.current.setState((s: WizardState) => ({
        ...s,
        practitioner: mockPractitioner,
        service: mockService,
        bookingType: "in_person",
        date: "2026-04-01",
        slot: mockSlot,
        step: "confirm",
      }))
    })

    act(() => { result.current.confirmBooking() })

    await waitFor(() => expect(result.current.state.step).toBe("success"))
    expect(result.current.state.booking).toEqual({ id: "bk-new" })
  })
})
