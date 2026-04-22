import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { BillingProvider, useBilling } from "@/lib/billing/billing-context"

const { useCurrentSubscription } = vi.hoisted(() => ({
  useCurrentSubscription: vi.fn(),
}))

vi.mock("@/hooks/use-current-subscription", () => ({
  useCurrentSubscription,
}))

function Probe() {
  const billing = useBilling()

  return (
    <div>
      <div data-testid="loading">{String(billing.isLoading)}</div>
      <div data-testid="active">{String(billing.isActive)}</div>
      <div data-testid="past-due">{String(billing.isPastDue)}</div>
      <div data-testid="suspended">{String(billing.isSuspended)}</div>
      <div data-testid="limits">{JSON.stringify(billing.limits)}</div>
    </div>
  )
}

describe("BillingProvider", () => {
  beforeEach(() => {
    useCurrentSubscription.mockReset()
  })

  it("keeps loading state while the subscription query is pending", () => {
    useCurrentSubscription.mockReturnValue({ data: undefined, isLoading: true })
    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getByTestId("loading")).toHaveTextContent("true")
  })

  it("marks ACTIVE and TRIALING subscriptions as active", () => {
    useCurrentSubscription.mockReturnValue({
      isLoading: false,
      data: {
        id: "sub-1",
        organizationId: "org-1",
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        currentPeriodStart: "2026-04-01T00:00:00.000Z",
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        plan: {
          id: "plan-1",
          slug: "PRO",
          nameAr: "محترف",
          nameEn: "Pro",
          priceMonthly: "199",
          priceAnnual: "1990",
          currency: "SAR",
          limits: { chatbotEnabled: true },
          sortOrder: 2,
        },
      },
    })

    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getByTestId("active")).toHaveTextContent("true")

    useCurrentSubscription.mockReturnValue({
      isLoading: false,
      data: {
        id: "sub-2",
        organizationId: "org-1",
        status: "TRIALING",
        billingCycle: "MONTHLY",
        currentPeriodStart: "2026-04-01T00:00:00.000Z",
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        plan: {
          id: "plan-1",
          slug: "PRO",
          nameAr: "محترف",
          nameEn: "Pro",
          priceMonthly: "199",
          priceAnnual: "1990",
          currency: "SAR",
          limits: {},
          sortOrder: 2,
        },
      },
    })

    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getAllByTestId("active")[1]).toHaveTextContent("true")
  })

  it("maps past-due and suspended flags from subscription status", () => {
    useCurrentSubscription.mockReturnValue({
      isLoading: false,
      data: {
        id: "sub-3",
        organizationId: "org-1",
        status: "PAST_DUE",
        billingCycle: "MONTHLY",
        currentPeriodStart: "2026-04-01T00:00:00.000Z",
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        plan: {
          id: "plan-1",
          slug: "PRO",
          nameAr: "محترف",
          nameEn: "Pro",
          priceMonthly: "199",
          priceAnnual: "1990",
          currency: "SAR",
          limits: {},
          sortOrder: 2,
        },
      },
    })

    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getByTestId("past-due")).toHaveTextContent("true")

    useCurrentSubscription.mockReturnValue({
      isLoading: false,
      data: {
        id: "sub-4",
        organizationId: "org-1",
        status: "SUSPENDED",
        billingCycle: "MONTHLY",
        currentPeriodStart: "2026-04-01T00:00:00.000Z",
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        plan: {
          id: "plan-1",
          slug: "PRO",
          nameAr: "محترف",
          nameEn: "Pro",
          priceMonthly: "199",
          priceAnnual: "1990",
          currency: "SAR",
          limits: {},
          sortOrder: 2,
        },
      },
    })

    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getAllByTestId("suspended")[1]).toHaveTextContent("true")
  })

  it("falls back to an empty limits object when there is no plan", () => {
    useCurrentSubscription.mockReturnValue({
      isLoading: false,
      data: null,
    })

    render(
      <BillingProvider>
        <Probe />
      </BillingProvider>,
    )

    expect(screen.getByTestId("limits")).toHaveTextContent("{}")
  })
})
