import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { BillingUsageWidget } from "@/components/billing-usage-widget"

const { useBilling, useLocale } = vi.hoisted(() => ({
  useBilling: vi.fn(),
  useLocale: vi.fn(),
}))

vi.mock("@/lib/billing/billing-context", () => ({
  useBilling,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale,
}))

describe("BillingUsageWidget", () => {
  beforeEach(() => {
    useBilling.mockReset()
    useLocale.mockReset()
    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.usage.title": "Usage",
          "billing.plan.label": "Your plan",
          "billing.usage.bookings": "Bookings this month",
          "billing.usage.upgradeCta": "Upgrade plan",
        }[key] ?? key),
    })
  })

  it("renders nothing while usage data is unavailable", () => {
    useBilling.mockReturnValue({
      isLoading: false,
      subscription: {
        plan: { nameAr: "محترف", nameEn: "Pro", limits: {} },
        usage: {},
      },
    })

    const { container } = render(<BillingUsageWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the plan, metric, and upgrade link near the threshold", () => {
    useBilling.mockReturnValue({
      isLoading: false,
      subscription: {
        plan: { nameAr: "محترف", nameEn: "Pro", limits: { maxBookingsPerMonth: 100 } },
        usage: { BOOKINGS_PER_MONTH: 85 },
      },
    })

    render(<BillingUsageWidget />)

    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("Bookings this month")).toBeInTheDocument()
    expect(screen.getByText("85 / 100")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Upgrade plan" })).toHaveAttribute(
      "href",
      "/settings/billing",
    )
  })
})
