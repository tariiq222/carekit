import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import BillingPage from "@/app/(dashboard)/subscription/page"

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
  const scheduleCancelMutateAsync = vi.fn()
  const resumeMutate = vi.fn()
  const reactivateMutate = vi.fn()
  const startMutateAsync = vi.fn()
  const retryPaymentMutate = vi.fn()

  beforeEach(() => {
    upgradeMutateAsync.mockReset()
    downgradeMutateAsync.mockReset()
    cancelMutateAsync.mockReset()
    scheduleCancelMutateAsync.mockReset()
    resumeMutate.mockReset()
    reactivateMutate.mockReset()
    startMutateAsync.mockReset()
    retryPaymentMutate.mockReset()

    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) =>
        ({
          "billing.title": "Billing & Subscription",
          "billing.description": "Manage your subscription plan, usage, and invoices.",
          "billing.banner.pastDue.title": "Your account is past due",
          "billing.banner.pastDue.description": "Please update your subscription to avoid service interruption.",
          "billing.banner.dunning.title": "Payment retry required",
          "billing.banner.dunning.description": "We will keep retrying the default card before access is suspended.",
          "billing.banner.dunning.nextRetry": "Next automatic retry",
          "billing.banner.dunning.retry": "Retry payment",
          "billing.banner.dunning.retrying": "Retrying...",
          "billing.banner.suspended.title": "Your subscription is suspended",
          "billing.banner.suspended.description": "Access is restricted until billing is resumed.",
          "billing.banner.scheduledCancel.title": "Cancellation scheduled",
          "billing.banner.scheduledCancel.description": "Your subscription stays active until the period ends.",
          "billing.banner.limitWarning.title": "Employee limit almost reached",
          "billing.banner.limitWarning.description": "Upgrade before adding more active employees.",
          "billing.limitReached.title": "Employee limit reached",
          "billing.limitReached.description": "Upgrade your plan to add another active employee.",
          "billing.limitReached.upgrade": "Upgrade plan",
          "billing.limitReached.close": "Close",
          "billing.summary.nextBilling": "Next billing date",
          "billing.summary.trialEnds": "Trial ends",
          "billing.summary.currentCycle": "Current cycle",
          "billing.summary.endsOn": "Ends on",
          "billing.status.active": "Active",
          "billing.status.pastDue": "Past due",
          "billing.status.suspended": "Suspended",
          "billing.actions.changePlan": "Change plan",
          "billing.actions.resume": "Resume subscription",
          "billing.actions.reactivate": "Reactivate",
          "billing.actions.cancel": "Cancel subscription",
          "billing.actions.confirm": "Confirm",
          "billing.actions.back": "Back",
          "billing.actions.submitting": "Updating...",
          "billing.actions.canceling": "Canceling...",
          "billing.actions.resuming": "Resuming...",
          "billing.actions.reactivating": "Reactivating...",
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
          "billing.cancel.scheduleConfirm": "Schedule cancellation",
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
      scheduleCancelMut: { isPending: false, mutateAsync: scheduleCancelMutateAsync },
      resumeMut: { isPending: false, mutate: resumeMutate },
      reactivateMut: { isPending: false, mutate: reactivateMutate },
      startMut: { isPending: false, mutateAsync: startMutateAsync },
      retryPaymentMut: { isPending: false, mutate: retryPaymentMutate },
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

    expect(screen.getByText("Payment retry required")).toBeInTheDocument()
  })

  it("allows a tenant to manually retry a failed payment from the dunning banner", async () => {
    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status: "PAST_DUE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      dunningRetryCount: 1,
      nextRetryAt: "2026-05-01T12:00:00.000Z",
      plan: {
        id: "basic",
        slug: "BASIC",
        nameEn: "Basic",
        nameAr: "أساسي",
        priceMonthly: "99",
        priceAnnual: "999",
        currency: "SAR",
        limits: { maxBookingsPerMonth: 50 },
        sortOrder: 1,
      },
      usage: { BOOKINGS_PER_MONTH: 25 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status: "PAST_DUE", subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })

    render(<BillingPage />)

    expect(screen.getByText("Next automatic retry: May 1, 2026")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Retry payment" }))
    expect(retryPaymentMutate).toHaveBeenCalledOnce()
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

  it("shows scheduled cancellation banner and reactivate action", async () => {
    const scheduledSub = {
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: "2026-05-01T00:00:00.000Z",
      plan: { ...proPlan, currency: "SAR" },
      usage: { BOOKINGS_PER_MONTH: 25 },
      invoices: [],
    }
    useBilling.mockReturnValue({
      status: "ACTIVE",
      subscription: scheduledSub,
      isLoading: false,
    })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: scheduledSub })

    render(<BillingPage />)

    expect(screen.getByText("Cancellation scheduled")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Reactivate" }))
    expect(reactivateMutate).toHaveBeenCalledOnce()
  })

  it("shows an employee limit warning at 80 percent usage", () => {
    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      plan: {
        ...proPlan,
        currency: "SAR",
        limits: { maxEmployees: 10 },
      },
      usage: { EMPLOYEES: 8 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status: "ACTIVE", subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })

    render(<BillingPage />)

    expect(screen.getByText("Employee limit almost reached")).toBeInTheDocument()
  })

  it("keeps scheduled cancellation priority over employee limit warning", () => {
    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: "2026-05-01T00:00:00.000Z",
      plan: {
        ...proPlan,
        currency: "SAR",
        limits: { maxEmployees: 10 },
      },
      usage: { employees: 9 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status: "ACTIVE", subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })

    render(<BillingPage />)

    expect(screen.getByText("Cancellation scheduled")).toBeInTheDocument()
    expect(screen.queryByText("Employee limit almost reached")).not.toBeInTheDocument()
  })

  it("opens and closes the employee limit reached dialog at 100 percent usage", async () => {
    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      plan: {
        ...proPlan,
        currency: "SAR",
        limits: { maxEmployees: 10 },
      },
      usage: { EMPLOYEES: 10 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status: "ACTIVE", subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })

    render(<BillingPage />)

    expect(screen.getByRole("dialog", { name: "Employee limit reached" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Employee limit reached" })).not.toBeInTheDocument(),
    )
  })

  it("opens the employee limit reached dialog when usage data arrives after loading", () => {
    useBilling.mockReturnValue({ status: null, subscription: null, isLoading: true })
    useCurrentSubscription.mockReturnValue({ isLoading: true, data: null })
    const { rerender } = render(<BillingPage />)

    expect(screen.queryByRole("dialog", { name: "Employee limit reached" })).not.toBeInTheDocument()

    const subscription = {
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      plan: {
        ...proPlan,
        currency: "SAR",
        limits: { maxEmployees: 10 },
      },
      usage: { EMPLOYEES: 10 },
      invoices: [],
    }
    useBilling.mockReturnValue({ status: "ACTIVE", subscription, isLoading: false })
    useCurrentSubscription.mockReturnValue({ isLoading: false, data: subscription })

    rerender(<BillingPage />)

    expect(screen.getByRole("dialog", { name: "Employee limit reached" })).toBeInTheDocument()
  })

  it("schedules paid cancellation instead of immediate cancel", async () => {
    mockBillingFor("ACTIVE", proPlan)

    render(<BillingPage />)

    await userEvent.click(screen.getByRole("button", { name: "Cancel subscription" }))
    await userEvent.type(screen.getByPlaceholderText("Tell us why you're canceling"), "Budget")
    await userEvent.click(screen.getByRole("button", { name: "Schedule cancellation" }))

    await waitFor(() => expect(scheduleCancelMutateAsync).toHaveBeenCalledWith("Budget"))
  })

  it("shows the resume action for suspended subscriptions", async () => {
    mockBillingFor("SUSPENDED", proPlan)

    render(<BillingPage />)
    await userEvent.click(screen.getByRole("button", { name: "Resume subscription" }))
    expect(resumeMutate).toHaveBeenCalledOnce()
  })
})
