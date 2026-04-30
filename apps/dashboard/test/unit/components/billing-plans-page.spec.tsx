import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import BillingPlansPage from "@/app/(dashboard)/settings/billing/plans/page"
import type { BillingCycle } from "@/lib/types/billing"

const {
  useLocale,
  useBilling,
  usePlans,
  useProrationPreview,
  useBillingMutations,
} = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useBilling: vi.fn(),
  usePlans: vi.fn(),
  useProrationPreview: vi.fn(),
  useBillingMutations: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/lib/billing/billing-context", () => ({ useBilling }))
vi.mock("@/hooks/use-current-subscription", () => ({
  usePlans,
  useProrationPreview,
  useBillingMutations,
}))
vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <div>Breadcrumbs</div>,
}))
vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}))

const plans = [
  {
    id: "basic",
    slug: "BASIC",
    nameAr: "أساسي",
    nameEn: "Basic",
    priceMonthly: "99",
    priceAnnual: "999",
    currency: "SAR",
    limits: { maxEmployees: 5, chatbotEnabled: false, zatcaEnabled: false },
    sortOrder: 1,
  },
  {
    id: "pro",
    slug: "PRO",
    nameAr: "محترف",
    nameEn: "Pro",
    priceMonthly: "199",
    priceAnnual: "1999",
    currency: "SAR",
    limits: { maxEmployees: 20, chatbotEnabled: true, zatcaEnabled: true },
    sortOrder: 2,
  },
]

function subscription(planId = "basic", scheduledPlanId?: string | null) {
  const plan = plans.find((item) => item.id === planId) ?? plans[0]
  return {
    id: "sub-1",
    organizationId: "org-1",
    status: "ACTIVE",
    billingCycle: "MONTHLY" as BillingCycle,
    currentPeriodStart: "2026-04-01T00:00:00.000Z",
    currentPeriodEnd: "2026-05-01T00:00:00.000Z",
    scheduledPlanId,
    scheduledBillingCycle: scheduledPlanId ? "MONTHLY" as BillingCycle : null,
    scheduledPlanChangeAt: scheduledPlanId ? "2026-05-01T00:00:00.000Z" : null,
    plan,
  }
}

describe("BillingPlansPage", () => {
  const upgradeMutateAsync = vi.fn()
  const scheduleDowngradeMutateAsync = vi.fn()
  const cancelScheduledDowngradeMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.plans.title": "Plans",
          "billing.plans.description": "Compare plans and choose the right subscription.",
          "billing.plan.monthly": "Monthly",
          "billing.plan.annual": "Annual",
          "billing.plan.current": "Current plan",
          "billing.plan.recommended": "Recommended",
          "billing.plans.payNow": "Pay {amount} SAR now",
          "billing.plans.scheduledFor": "Scheduled for {date}",
          "billing.plans.cancelScheduled": "Cancel scheduled downgrade",
          "billing.actions.upgrade": "Upgrade plan",
          "billing.actions.downgrade": "Schedule downgrade",
          "billing.actions.submitting": "Updating...",
          "billing.plans.features": "Feature comparison",
          "billing.plans.employees": "Employees",
          "billing.plans.chatbot": "AI chatbot",
          "billing.plans.zatca": "ZATCA",
          "billing.usage.unlimited": "Unlimited",
        }[key] ?? key),
      format: (key: string, vars: Record<string, string>) =>
        key === "billing.plans.payNow"
          ? `Pay ${vars.amount} SAR now`
          : `Scheduled for ${vars.date}`,
    })
    usePlans.mockReturnValue({ data: plans, isLoading: false })
    useProrationPreview.mockImplementation((dto: { planId: string } | null) => ({
      data: dto?.planId === "pro"
        ? { action: "UPGRADE_NOW", amountSar: "58.00", effectiveAt: "2026-04-16T00:00:00.000Z" }
        : { action: "SCHEDULE_DOWNGRADE", amountSar: "0.00", effectiveAt: "2026-05-01T00:00:00.000Z" },
      isLoading: false,
    }))
    useBillingMutations.mockReturnValue({
      upgradeMut: { isPending: false, mutateAsync: upgradeMutateAsync },
      scheduleDowngradeMut: { isPending: false, mutateAsync: scheduleDowngradeMutateAsync },
      cancelScheduledDowngradeMut: {
        isPending: false,
        mutateAsync: cancelScheduledDowngradeMutateAsync,
      },
    })
  })

  it("renders the monthly and annual segmented control", () => {
    useBilling.mockReturnValue({ subscription: subscription("basic"), isLoading: false })

    render(<BillingPlansPage />)

    expect(screen.getByRole("button", { name: "Monthly" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annual" })).toBeInTheDocument()
  })

  it("marks the current plan and shows upgrade preview copy", () => {
    useBilling.mockReturnValue({ subscription: subscription("basic"), isLoading: false })

    render(<BillingPlansPage />)

    expect(screen.getAllByText("Current plan").length).toBeGreaterThan(0)
    expect(screen.getByText("Pay 58.00 SAR now")).toBeInTheDocument()
  })

  it("shows scheduled downgrade copy for lower target plans", () => {
    useBilling.mockReturnValue({ subscription: subscription("pro"), isLoading: false })

    render(<BillingPlansPage />)

    expect(screen.getByText("Scheduled for May 1, 2026")).toBeInTheDocument()
  })

  it("offers cancel scheduled downgrade when one already exists", async () => {
    useBilling.mockReturnValue({
      subscription: subscription("pro", "basic"),
      isLoading: false,
    })

    render(<BillingPlansPage />)

    await userEvent.click(screen.getByRole("button", { name: "Cancel scheduled downgrade" }))
    expect(cancelScheduledDowngradeMutateAsync).toHaveBeenCalledOnce()
  })
})
