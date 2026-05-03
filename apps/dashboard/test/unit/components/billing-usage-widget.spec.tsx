import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { BillingUsageWidget } from "@/components/billing-usage-widget"

const { useUsage, useLocale } = vi.hoisted(() => ({
  useUsage: vi.fn(),
  useLocale: vi.fn(),
}))

vi.mock("@/hooks/use-usage", () => ({
  useUsage,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale,
}))

describe("BillingUsageWidget", () => {
  beforeEach(() => {
    useUsage.mockReset()
    useLocale.mockReset()
    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.usage.title": "Usage",
          "billing.usage.bookings": "Bookings this month",
          "billing.usage.employees": "Employees",
          "billing.usage.upgradeCta": "Upgrade plan",
          "billing.usage.warning": "Approaching limit",
        }[key] ?? key),
    })
  })

  it("renders nothing while usage data is unavailable", () => {
    // Widget returns null when rows is empty or loading
    useUsage.mockReturnValue({ data: [], isLoading: false })

    const { container } = render(<BillingUsageWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders employee usage and upgrade link near the threshold", () => {
    // Widget reads UsageRow[] from useUsage(); plan name is not rendered
    useUsage.mockReturnValue({
      isLoading: false,
      data: [{ featureKey: "employees", current: 8, limit: 10, percentage: 80 }],
    })

    render(<BillingUsageWidget />)

    expect(screen.getByText("Employees")).toBeInTheDocument()
    expect(screen.queryByText("Bookings this month")).not.toBeInTheDocument()
    expect(screen.getByText("8 / 10")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Upgrade plan" })).toHaveAttribute(
      "href",
      "/subscription",
    )
  })
})
