import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
  getAccessToken: vi.fn(() => null),
}))

import {
  fetchInvoices,
  fetchInvoice,
  fetchInvoiceStats,
  fetchInvoiceByPayment,
  createInvoice,
  markInvoiceAsSent,
} from "@/lib/api/invoices"

describe("invoices api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchInvoices calls /invoices with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchInvoices({ page: 1, zatcaStatus: "pending" })
    expect(getMock).toHaveBeenCalledWith("/invoices", expect.objectContaining({ zatcaStatus: "pending" }))
  })

  it("fetchInvoice calls /invoices/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "inv-1" })
    await fetchInvoice("inv-1")
    expect(getMock).toHaveBeenCalledWith("/invoices/inv-1")
  })

  it("fetchInvoiceStats calls /invoices/stats", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchInvoiceStats()
    expect(getMock).toHaveBeenCalledWith("/invoices/stats")
  })

  it("fetchInvoiceByPayment calls /invoices/payment/:paymentId", async () => {
    getMock.mockResolvedValueOnce({ id: "inv-1" })
    await fetchInvoiceByPayment("pay-1")
    expect(getMock).toHaveBeenCalledWith("/invoices/payment/pay-1")
  })

  it("createInvoice posts to /invoices", async () => {
    postMock.mockResolvedValueOnce({ id: "inv-1" })
    await createInvoice({ paymentId: "pay-1" } as Parameters<typeof createInvoice>[0])
    expect(postMock).toHaveBeenCalledWith("/invoices", expect.objectContaining({ paymentId: "pay-1" }))
  })

  it("markInvoiceAsSent patches /invoices/:id/send", async () => {
    patchMock.mockResolvedValueOnce({ id: "inv-1" })
    await markInvoiceAsSent("inv-1")
    expect(patchMock).toHaveBeenCalledWith("/invoices/inv-1/send")
  })
})
