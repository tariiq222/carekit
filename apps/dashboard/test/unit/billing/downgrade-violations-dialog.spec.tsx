import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { DowngradeViolationsDialog } from "@/components/features/billing/downgrade-violations-dialog"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}))

describe("DowngradeViolationsDialog", () => {
  it("renders quantitative violation row for employees", () => {
    render(
      <DowngradeViolationsDialog
        open
        onOpenChange={() => {}}
        violations={[
          { kind: "QUANTITATIVE", featureKey: "employees", current: 12, targetMax: 5 },
        ]}
        targetPlanName="BASIC"
        onChooseHigherPlan={() => {}}
      />,
    )
    expect(screen.getByText(/billing\.downgradeViolations\.employees\.title/)).toBeInTheDocument()
  })

  it("renders boolean violation with deep link", () => {
    render(
      <DowngradeViolationsDialog
        open
        onOpenChange={() => {}}
        violations={[
          {
            kind: "BOOLEAN",
            featureKey: "coupons",
            blockingResources: { count: 3, sampleIds: ["c1", "c2", "c3"], deepLink: "/coupons" },
          },
        ]}
        targetPlanName="BASIC"
        onChooseHigherPlan={() => {}}
      />,
    )
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/coupons")
  })

  it("calls onChooseHigherPlan when button clicked", () => {
    const fn = vi.fn()
    render(
      <DowngradeViolationsDialog
        open
        onOpenChange={() => {}}
        violations={[]}
        targetPlanName="BASIC"
        onChooseHigherPlan={fn}
      />,
    )
    const buttons = screen.getAllByRole("button")
    const chooseHigherBtn = buttons.find(b => b.textContent?.includes("chooseHigherPlan"))
    chooseHigherBtn?.click()
    expect(fn).toHaveBeenCalled()
  })
})
