import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import BillingPage from "@/app/(dashboard)/settings/billing/page"

const {
  useLocale,
  useBilling,
  useCurrentSubscription,
  usePlans,
  useBillingMutations,
} = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useBilling: vi.fn(),
  useCurrentSubscription: vi.fn(),
  usePlans: vi.fn(),
  useBillingMutations: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale,
}))

vi.mock("@/lib/billing/billing-context", () => ({
  useBilling,
}))

vi.mock("@/hooks/use-current-subscription", () => ({
  useCurrentSubscription,
  usePlans,
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

describe("BillingPage", () => {
  const upgradeMutateAsync = vi.fn()
  const downgradeMutateAsync = vi.fn()
  const cancelMutateAsync = vi.fn()
  const resumeMutate = vi.fn()
  const startMutateAsync = vi.fn()

  beforeEach(() => {
    upgradeMutateAsync.mockReset()
    downgradeMutateAsync.mockReset()
    cancelMutateAsync.mockReset()
    resumeMutate.mockReset()
    startMutateAsync.mockReset()

    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.title": "Billing & Subscription",
          "billing.description": "Manage your subscription plan, usage, and invoices.",
          "billing.banner.pastDue.title": "Your account is past due",
          "billing.banner.pastDue.description": "Please update your subscription to avoid service interruption.",
          "billing.banner.suspended.title": "Your subscription is suspended",
          "billing.banner.suspended.description": "Access is restricted until billing is resumed.",
          "billing.summary.nextBilling": "Next billing date",
          "billing.summary.trialEnds": "Trial ends",
          "billing.summary.currentCycle": "Current cycle",
          "billing.status.active": "Active",
          "billing.status.pastDue": "Past due",
          "billing.status.suspended": "Suspended",
          "billing.actions.changePlan": "Change plan",
          "billing.actions.resume": "Resume subscription",
          "billing.actions.cancel": "Cancel subscription",
          "billing.actions.confirm": "Confirm",
          "billing.actions.back": "Back",
          "billing.actions.submitting": "Updating...",
          "billing.actions.canceling": "Canceling...",
          "billing.actions.resuming": "Resuming...",
          "billing.plan.dialogTitle": "Choose a plan",
          "billing.plan.dialogDescription": "Compare plans and apply the change to your current subscription.",
          "billing.plan.monthly": "Monthly",
          "billing.plan.annual": "Annual",
          "billing.plan.current": "Current plan",
          "billing.plan.targetPrice": "Price",
          "billing.cancel.dialogTitle": "Cancel subscription",
          "billing.cancel.dialogDescription": "Your subscription will be canceled at the end of the current billing period.",
          "billing.cancel.reasonLabel": "Reason (optional)",
          "billing.cancel.reasonPlaceholder": "Tell us why you're canceling",
          "billing.cancel.confirm": "Confirm cancellation",
          "billing.cancel.keep": "Keep subscription",
          "billing.empty.subscription": "No active subscription.",
          "billing.usage.heading": "Usage limits",
          "billing.usage.bookings": "Bookings this month",
          "billing.usage.branches": "Branches",
          "billing.usage.employees": "Employees",
          "billing.usage.clients": "Clients",
          "billing.usage.storage": "Storage (MB)",
          "billing.usage.unlimited": "Unlimited",
          "billing.usage.unavailable": "Not available",
          "billing.invoices.title": "Invoices",
          "billing.invoices.empty": "No invoices yet",
          "billing.invoices.date": "Date",
          "billing.invoices.period": "Period",
          "billing.invoices.amount": "Amount",
          "billing.invoices.status": "Status",
        }[key] ?? key),
    })

    useBillingMutations.mockReturnValue({
      upgradeMut: { isPending: false, mutateAsync: upgradeMutateAsync },
      downgradeMut: { isPending: false, mutateAsync: downgradeMutateAsync },
      cancelMut: { isPending: false, mutateAsync: cancelMutateAsync },
      resumeMut: { isPending: false, mutate: resumeMutate },
      startMut: { isPending: false, mutateAsync: startMutateAsync },
    })

    usePlans.mockReturnValue({
      data: [
        {
          id: "basic",
          slug: "BASIC",
          nameAr: "أساسي",
          nameEn: "Basic",
          priceMonthly: "99",
          priceAnnual: "999",
          currency: "SAR",
          limits: { maxBookingsPerMonth: 50 },
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
          limits: { maxBookingsPerMonth: 100 },
          sortOrder: 2,
        },
      ],
    })
  })

  function mockBillingFor(
    status: "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED" | "TRIALING",
    planOverride?: { id: string; slug: "BASIC" | "PRO"; nameEn: string; nameAr: string; priceMonthly: string; priceAnnual: string; limits: Record<string, number>; sortOrder: number },
  ) {
    const plan = planOverride ?? {
      id: "basic",
      slug: "BASIC" as const,
      nameEn: "Basic",
      nameAr: "أساسي",
      priceMonthly: "99",
      priceAnnual: "999",
      limits: { maxBookingsPerMonth: 50 },
      sortOrder: 1,
    }
    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status,
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      plan: { ...plan, currency: "SAR" },
      usage: { BOOKINGS_PER_MONTH: 25 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status, subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })
  }

  it("shows the past-due banner", () => {
    mockBillingFor("PAST_DUE")

    render(<BillingPage />)

    expect(screen.getByText("Your account is past due")).toBeInTheDocument()
  })

  it("opens the plan dialog and submits an upgrade", async () => {
    mockBillingFor("ACTIVE")

    render(<BillingPage />)

    await userEvent.click(screen.getByRole("button", { name: "Change plan" }))
    await userEvent.click(screen.getByRole("button", { name: /Pro Price: SAR 199/ }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    await waitFor(() =>
      expect(upgradeMutateAsync).toHaveBeenCalledWith({
        planId: "pro",
        billingCycle: "MONTHLY",
        isDowngrade: false,
      }),
    )
  })

  const proPlan = {
    id: "pro",
    slug: "PRO" as const,
    nameAr: "محترف",
    nameEn: "Pro",
    priceMonthly: "199",
    priceAnnual: "1999",
    limits: { maxBookingsPerMonth: 100 },
    sortOrder: 2,
  }

  it("opens the cancel dialog and submits the cancellation", async () => {
    mockBillingFor("ACTIVE", proPlan)

    render(<BillingPage />)

    await userEvent.click(screen.getByRole("button", { name: "Cancel subscription" }))
    await userEvent.type(screen.getByPlaceholderText("Tell us why you're canceling"), "Budget")
    await userEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }))

    await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledWith("Budget"))
  })

  it("shows the resume action for suspended subscriptions", async () => {
    mockBillingFor("SUSPENDED", proPlan)

    render(<BillingPage />)
    await userEvent.click(screen.getByRole("button", { name: "Resume subscription" }))
    expect(resumeMutate).toHaveBeenCalledOnce()
  })
})
