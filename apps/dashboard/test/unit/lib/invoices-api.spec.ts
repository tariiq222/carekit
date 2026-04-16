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
  fetchInvoice,
  createInvoice,
} from "@/lib/api/invoices"

describe("invoices api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchInvoice calls /invoices/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "inv-1" })
    await fetchInvoice("inv-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/invoices/inv-1")
  })

  it("createInvoice posts to /invoices", async () => {
    postMock.mockResolvedValueOnce({ id: "inv-1" })
    await createInvoice({ paymentId: "pay-1" } as Parameters<typeof createInvoice>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/invoices", expect.objectContaining({ paymentId: "pay-1" }))
  })

})
