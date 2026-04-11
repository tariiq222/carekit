import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
}))

import {
  fetchBookings,
  fetchBooking,
  fetchBookingStats,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  approveCancellation,
  rejectCancellation,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  practitionerCancelBooking,
  requestCancellation,
  createRecurringBooking,
  patientReschedule,
} from "@/lib/api/bookings"

describe("bookings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBookings sends filters to /bookings", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBookings({ page: 1, status: "confirmed" })
    expect(getMock).toHaveBeenCalledWith("/bookings", expect.objectContaining({ status: "confirmed" }))
  })

  it("fetchBooking calls /bookings/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "bk-1" })
    await fetchBooking("bk-1")
    expect(getMock).toHaveBeenCalledWith("/bookings/bk-1")
  })

  it("fetchBookingStats calls /bookings/stats", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchBookingStats()
    expect(getMock).toHaveBeenCalledWith("/bookings/stats")
  })

  it("createBooking posts to /bookings", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await createBooking({ serviceId: "svc-1" } as Parameters<typeof createBooking>[0])
    expect(postMock).toHaveBeenCalledWith("/bookings", expect.objectContaining({ serviceId: "svc-1" }))
  })

  it("rescheduleBooking patches /bookings/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await rescheduleBooking("bk-1", { slotStart: "2026-04-01T10:00:00Z" } as Parameters<typeof rescheduleBooking>[1])
    expect(patchMock).toHaveBeenCalledWith("/bookings/bk-1", expect.anything())
  })

  it("confirmBooking posts to /bookings/:id/confirm", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await confirmBooking("bk-1")
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/confirm")
  })

  it("completeBooking posts to /bookings/:id/complete", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await completeBooking("bk-1")
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/complete")
  })

  it("markNoShow posts to /bookings/:id/no-show", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await markNoShow("bk-1")
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/no-show")
  })

  it("approveCancellation posts to /bookings/:id/cancel/approve", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await approveCancellation("bk-1", {} as Parameters<typeof approveCancellation>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/cancel/approve", expect.anything())
  })

  it("rejectCancellation posts to /bookings/:id/cancel/reject", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await rejectCancellation("bk-1", {} as Parameters<typeof rejectCancellation>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/cancel/reject", expect.anything())
  })

  it("checkInBooking posts to /bookings/:id/check-in", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await checkInBooking("bk-1")
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/check-in")
  })

  it("startBooking posts to /bookings/:id/start", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await startBooking("bk-1")
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/start")
  })

  it("adminCancelBooking posts to /bookings/:id/admin-cancel", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await adminCancelBooking("bk-1", {} as Parameters<typeof adminCancelBooking>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/admin-cancel", expect.anything())
  })

  it("practitionerCancelBooking posts to /bookings/:id/practitioner-cancel", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await practitionerCancelBooking("bk-1", {} as Parameters<typeof practitionerCancelBooking>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/practitioner-cancel", expect.anything())
  })

  it("requestCancellation posts to /bookings/:id/cancel-request", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await requestCancellation("bk-1", {} as Parameters<typeof requestCancellation>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/cancel-request", expect.anything())
  })

  it("createRecurringBooking posts to /bookings/recurring", async () => {
    postMock.mockResolvedValueOnce([])
    await createRecurringBooking({} as Parameters<typeof createRecurringBooking>[0])
    expect(postMock).toHaveBeenCalledWith("/bookings/recurring", expect.anything())
  })

  it("patientReschedule posts to /bookings/:id/patient-reschedule", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await patientReschedule("bk-1", {} as Parameters<typeof patientReschedule>[1])
    expect(postMock).toHaveBeenCalledWith("/bookings/bk-1/patient-reschedule", expect.anything())
  })
})
