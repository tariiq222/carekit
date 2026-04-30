import { beforeEach, describe, expect, it, vi } from "vitest"

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  api: apiMock,
}))

import { billingApi } from "@/lib/api/billing"

describe("billingApi saved cards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists saved cards from dashboard billing", async () => {
    apiMock.get.mockResolvedValueOnce([{ id: "card-1" }])

    await billingApi.listSavedCards()

    expect(apiMock.get).toHaveBeenCalledWith("/dashboard/billing/saved-cards")
  })

  it("adds a saved card with frontend retry idempotency", async () => {
    const dto = {
      moyasarTokenId: "token_abc",
      makeDefault: true,
      idempotencyKey: "1f210deb-3501-4c46-8fd5-2f89f318a39b",
    }
    apiMock.post.mockResolvedValueOnce({ id: "card-1" })

    await billingApi.addSavedCard(dto)

    expect(apiMock.post).toHaveBeenCalledWith("/dashboard/billing/saved-cards", dto)
  })

  it("sets the default card", async () => {
    apiMock.patch.mockResolvedValueOnce({ id: "card-1", isDefault: true })

    await billingApi.setDefaultSavedCard("card-1")

    expect(apiMock.patch).toHaveBeenCalledWith(
      "/dashboard/billing/saved-cards/card-1/set-default",
      {},
    )
  })

  it("removes a saved card", async () => {
    apiMock.delete.mockResolvedValueOnce({ ok: true })

    await billingApi.removeSavedCard("card-1")

    expect(apiMock.delete).toHaveBeenCalledWith("/dashboard/billing/saved-cards/card-1")
  })
})

describe("billingApi plan changes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requests a manual dunning retry", async () => {
    apiMock.post.mockResolvedValueOnce({ ok: true, status: "PAID", attemptNumber: 1 })

    await billingApi.retryPayment()

    expect(apiMock.post).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/retry-payment",
      {},
    )
  })

  it("requests a proration preview with plan and billing cycle query params", async () => {
    apiMock.get.mockResolvedValueOnce({ action: "UPGRADE_NOW", amountHalalas: 30000 })

    await billingApi.prorationPreview({ planId: "plan-pro", billingCycle: "MONTHLY" })

    expect(apiMock.get).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/proration-preview",
      { planId: "plan-pro", billingCycle: "MONTHLY" },
    )
  })

  it("schedules and cancels a scheduled downgrade", async () => {
    const dto = { planId: "plan-basic", billingCycle: "MONTHLY" as const }
    apiMock.post.mockResolvedValueOnce({ scheduledPlanId: "plan-basic" })
    apiMock.post.mockResolvedValueOnce({ scheduledPlanId: null })

    await billingApi.scheduleDowngrade(dto)
    await billingApi.cancelScheduledDowngrade()

    expect(apiMock.post).toHaveBeenNthCalledWith(
      1,
      "/dashboard/billing/subscription/schedule-downgrade",
      dto,
    )
    expect(apiMock.post).toHaveBeenNthCalledWith(
      2,
      "/dashboard/billing/subscription/cancel-scheduled-downgrade",
      {},
    )
  })
})
