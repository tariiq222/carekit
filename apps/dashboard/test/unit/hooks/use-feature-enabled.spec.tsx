import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { FeatureKey } from "@deqah/shared/constants"
import { useFeatureEnabled } from "@/hooks/use-feature-enabled"

const { useBilling } = vi.hoisted(() => ({
  useBilling: vi.fn(),
}))

vi.mock("@/lib/billing/billing-context", () => ({
  useBilling,
}))

describe("useFeatureEnabled", () => {
  beforeEach(() => {
    useBilling.mockReset()
  })

  it("returns true when the feature key is absent but the subscription is active", () => {
    useBilling.mockReturnValue({ limits: {}, status: "ACTIVE" })
    const { result } = renderHook(() => useFeatureEnabled(FeatureKey.AI_CHATBOT))
    expect(result.current).toBe(true)
  })

  it("returns true for boolean limits set to true", () => {
    useBilling.mockReturnValue({ limits: { ai_chatbot: true }, status: "ACTIVE" })
    const { result } = renderHook(() => useFeatureEnabled(FeatureKey.AI_CHATBOT))
    expect(result.current).toBe(true)
  })

  it("returns false for boolean limits set to false", () => {
    useBilling.mockReturnValue({ limits: { ai_chatbot: false }, status: "ACTIVE" })
    const { result } = renderHook(() => useFeatureEnabled(FeatureKey.AI_CHATBOT))
    expect(result.current).toBe(false)
  })

  it("returns true only when numeric limits are greater than zero", () => {
    useBilling.mockReturnValue({ limits: { advanced_reports: 3 }, status: "ACTIVE" })
    const positive = renderHook(() => useFeatureEnabled(FeatureKey.ADVANCED_REPORTS))
    expect(positive.result.current).toBe(true)

    useBilling.mockReturnValue({ limits: { advanced_reports: 0 }, status: "ACTIVE" })
    const zero = renderHook(() => useFeatureEnabled(FeatureKey.ADVANCED_REPORTS))
    expect(zero.result.current).toBe(false)
  })

  it("returns false when the subscription is suspended", () => {
    useBilling.mockReturnValue({ limits: { ai_chatbot: true }, status: "SUSPENDED" })
    const { result } = renderHook(() => useFeatureEnabled(FeatureKey.AI_CHATBOT))
    expect(result.current).toBe(false)
  })
})
