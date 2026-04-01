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
  fetchPayments,
  fetchPayment,
  fetchPaymentStats,
  fetchPaymentByBooking,
  refundPayment,
  updatePaymentStatus,
  verifyBankTransfer,
  reviewReceipt,
} from "@/lib/api/payments"

describe("payments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches payment list with filter params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchPayments({ page: 1, status: "paid", method: "bank_transfer" })
    expect(getMock).toHaveBeenCalledWith("/payments", expect.objectContaining({ page: 1, status: "paid", method: "bank_transfer" }))
  })

  it("fetches single payment by id", async () => {
    getMock.mockResolvedValueOnce({ id: "pay-1" })
    await fetchPayment("pay-1")
    expect(getMock).toHaveBeenCalledWith("/payments/pay-1")
  })

  it("fetches payment stats via GET /payments/stats", async () => {
    getMock.mockResolvedValueOnce({ total: 50000, pending: 3 })
    await fetchPaymentStats()
    expect(getMock).toHaveBeenCalledWith("/payments/stats")
  })

  it("fetches payment by booking id", async () => {
    getMock.mockResolvedValueOnce({ id: "pay-2", bookingId: "bk-1" })
    await fetchPaymentByBooking("bk-1")
    expect(getMock).toHaveBeenCalledWith("/payments/booking/bk-1")
  })

  it("refunds payment via POST /payments/:id/refund", async () => {
    postMock.mockResolvedValueOnce({ id: "pay-1", status: "REFUNDED" })
    await refundPayment("pay-1", { reason: "Customer request", amount: 500 })
    expect(postMock).toHaveBeenCalledWith("/payments/pay-1/refund", { reason: "Customer request", amount: 500 })
  })

  it("updates payment status via PATCH /payments/:id/status", async () => {
    patchMock.mockResolvedValueOnce({ id: "pay-1", status: "PAID" })
    await updatePaymentStatus("pay-1", { status: "paid" })
    expect(patchMock).toHaveBeenCalledWith("/payments/pay-1/status", { status: "paid" })
  })

  it("verifies bank transfer via POST /payments/bank-transfer/:id/verify", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await verifyBankTransfer("pay-1", { action: "approve", adminNotes: "Confirmed" })
    expect(postMock).toHaveBeenCalledWith("/payments/bank-transfer/pay-1/verify", { action: "approve", adminNotes: "Confirmed" })
  })

  it("routes reviewReceipt (approved) to bank-transfer verify endpoint", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await reviewReceipt("rec-1", { approved: true, adminNotes: "OK" })
    expect(postMock).toHaveBeenCalledWith("/payments/bank-transfer/rec-1/verify", { action: "approve", adminNotes: "OK" })
  })

  it("routes reviewReceipt (rejected) with reject action", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await reviewReceipt("rec-1", { approved: false, adminNotes: "Invalid" })
    expect(postMock).toHaveBeenCalledWith("/payments/bank-transfer/rec-1/verify", { action: "reject", adminNotes: "Invalid" })
  })
})
