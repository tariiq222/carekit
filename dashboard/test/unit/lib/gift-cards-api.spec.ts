import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchGiftCards,
  fetchGiftCard,
  createGiftCard,
  updateGiftCard,
  deactivateGiftCard,
  checkGiftCardBalance,
  addGiftCardCredit,
} from "@/lib/api/gift-cards"

describe("gift-cards api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchGiftCards calls /gift-cards with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchGiftCards({ page: 1, status: "active" })
    expect(getMock).toHaveBeenCalledWith("/gift-cards", expect.objectContaining({ status: "active" }))
  })

  it("fetchGiftCard calls /gift-cards/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "gc-1" })
    await fetchGiftCard("gc-1")
    expect(getMock).toHaveBeenCalledWith("/gift-cards/gc-1")
  })

  it("createGiftCard posts to /gift-cards", async () => {
    postMock.mockResolvedValueOnce({ id: "gc-1" })
    await createGiftCard({ initialAmount: 100 } as Parameters<typeof createGiftCard>[0])
    expect(postMock).toHaveBeenCalledWith("/gift-cards", expect.objectContaining({ initialAmount: 100 }))
  })

  it("updateGiftCard patches /gift-cards/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "gc-1" })
    await updateGiftCard("gc-1", { amount: 200 } as Parameters<typeof updateGiftCard>[1])
    expect(patchMock).toHaveBeenCalledWith("/gift-cards/gc-1", expect.anything())
  })

  it("deactivateGiftCard deletes /gift-cards/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deactivateGiftCard("gc-1")
    expect(deleteMock).toHaveBeenCalledWith("/gift-cards/gc-1")
  })

  it("checkGiftCardBalance posts to /gift-cards/check-balance", async () => {
    postMock.mockResolvedValueOnce({ balance: 50 })
    await checkGiftCardBalance("GC-CODE-123")
    expect(postMock).toHaveBeenCalledWith("/gift-cards/check-balance", { code: "GC-CODE-123" })
  })

  it("addGiftCardCredit posts to /gift-cards/:id/credit", async () => {
    postMock.mockResolvedValueOnce({ id: "gc-1" })
    await addGiftCardCredit("gc-1", { amount: 50 } as Parameters<typeof addGiftCardCredit>[1])
    expect(postMock).toHaveBeenCalledWith("/gift-cards/gc-1/credit", expect.anything())
  })
})
