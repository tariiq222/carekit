import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchClinicHours,
  updateClinicHours,
  fetchClinicHolidays,
  createClinicHoliday,
  deleteClinicHoliday,
} = vi.hoisted(() => ({
  fetchClinicHours: vi.fn(),
  updateClinicHours: vi.fn(),
  fetchClinicHolidays: vi.fn(),
  createClinicHoliday: vi.fn(),
  deleteClinicHoliday: vi.fn(),
}))

const { fetchBookingSettings, updateBookingSettings } = vi.hoisted(() => ({
  fetchBookingSettings: vi.fn(),
  updateBookingSettings: vi.fn(),
}))

vi.mock("@/lib/api/clinic", () => ({
  fetchClinicHours,
  updateClinicHours,
  fetchClinicHolidays,
  createClinicHoliday,
  deleteClinicHoliday,
}))

vi.mock("@/lib/api/booking-settings", () => ({
  fetchBookingSettings,
  updateBookingSettings,
}))

import {
  useClinicHours,
  useClinicHoursMutation,
  useClinicHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useBookingSettings,
  useBookingSettingsMutation,
} from "@/hooks/use-clinic-settings"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useClinicHours", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches clinic hours", async () => {
    const hours = [{ day: "MONDAY", isOpen: true }]
    fetchClinicHours.mockResolvedValueOnce(hours)

    const { result } = renderHook(() => useClinicHours(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchClinicHours).toHaveBeenCalled()
    expect(result.current.data).toEqual(hours)
  })
})

describe("useClinicHoursMutation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls updateClinicHours with payload", async () => {
    updateClinicHours.mockResolvedValueOnce([])

    const { result } = renderHook(() => useClinicHoursMutation(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate([] as Parameters<typeof updateClinicHours>[0])
    })

    await waitFor(() => expect(updateClinicHours).toHaveBeenCalled())
  })
})

describe("useClinicHolidays", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches clinic holidays", async () => {
    const holidays = [{ id: "h-1", name: "National Day", date: "2026-09-23" }]
    fetchClinicHolidays.mockResolvedValueOnce(holidays)

    const { result } = renderHook(() => useClinicHolidays(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchClinicHolidays).toHaveBeenCalled()
    expect(result.current.data).toEqual(holidays)
  })
})

describe("useCreateHoliday", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls createClinicHoliday with data", async () => {
    createClinicHoliday.mockResolvedValueOnce({ id: "h-2" })

    const { result } = renderHook(() => useCreateHoliday(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ nameAr: "عيد", nameEn: "Eid", date: "2026-03-30", isRecurring: false })
    })

    await waitFor(() =>
      expect(createClinicHoliday).toHaveBeenCalledWith(
        expect.objectContaining({ nameAr: "عيد" }),
        expect.anything(),
      ),
    )
  })
})

describe("useDeleteHoliday", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls deleteClinicHoliday with id", async () => {
    deleteClinicHoliday.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteHoliday(), { wrapper: makeWrapper() })

    act(() => { result.current.mutate("h-1") })

    await waitFor(() => expect(deleteClinicHoliday).toHaveBeenCalledWith("h-1", expect.anything()))
  })
})

describe("useBookingSettings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches booking settings", async () => {
    const settings = { allowWalkIn: true, maxAdvanceDays: 30 }
    fetchBookingSettings.mockResolvedValueOnce(settings)

    const { result } = renderHook(() => useBookingSettings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBookingSettings).toHaveBeenCalled()
    expect(result.current.data).toEqual(settings)
  })
})

describe("useBookingSettingsMutation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls updateBookingSettings with payload", async () => {
    updateBookingSettings.mockResolvedValueOnce({ allowWalkIn: false })

    const { result } = renderHook(() => useBookingSettingsMutation(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({ allowWalkIn: false } as Parameters<typeof updateBookingSettings>[0])
    })

    await waitFor(() =>
      expect(updateBookingSettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowWalkIn: false }),
        expect.anything(),
      ),
    )
  })
})
