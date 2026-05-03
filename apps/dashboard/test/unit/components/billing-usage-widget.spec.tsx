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

vi.mock("@/hooks/use-usage", () => ({
  useUsage: vi.fn(() => ({ data: [], isLoading: false })),
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
          "billing.usage.employees": "Employees",
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

  it("renders employee usage and upgrade link near the threshold", () => {
    useBilling.mockReturnValue({
      isLoading: false,
      subscription: {
        plan: { nameAr: "محترف", nameEn: "Pro", limits: { maxEmployees: 10 } },
        usage: { EMPLOYEES: 8 },
      },
    })

    render(<BillingUsageWidget />)

    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("Employees")).toBeInTheDocument()
    expect(screen.queryByText("Bookings this month")).not.toBeInTheDocument()
    expect(screen.getByText("8 / 10")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Upgrade plan" })).toHaveAttribute(
      "href",
      "/subscription",
    )
  })
})
