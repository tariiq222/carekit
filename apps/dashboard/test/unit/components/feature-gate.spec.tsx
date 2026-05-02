import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FeatureKey } from "@deqah/shared/constants"
import { FeatureGate } from "@/components/feature-gate"

const { useFeatureEnabled } = vi.hoisted(() => ({
  useFeatureEnabled: vi.fn(),
}))

vi.mock("@/hooks/use-feature-enabled", () => ({
  useFeatureEnabled,
}))

describe("FeatureGate", () => {
  it("renders children when the feature is enabled", () => {
    useFeatureEnabled.mockReturnValue(true)
    render(<FeatureGate feature={FeatureKey.AI_CHATBOT}><div>Allowed</div></FeatureGate>)
    expect(screen.getByText("Allowed")).toBeInTheDocument()
  })

  it("renders the fallback when the feature is disabled", () => {
    useFeatureEnabled.mockReturnValue(false)
    render(
      <FeatureGate feature={FeatureKey.AI_CHATBOT} fallback={<div>Blocked</div>}>
        <div>Allowed</div>
      </FeatureGate>,
    )

    expect(screen.getByText("Blocked")).toBeInTheDocument()
    expect(screen.queryByText("Allowed")).not.toBeInTheDocument()
  })
})
