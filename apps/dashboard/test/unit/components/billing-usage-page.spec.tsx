import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import BillingUsagePage from "@/app/(dashboard)/subscription/usage/page"

const { useLocale, useBilling } = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useBilling: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/lib/billing/billing-context", () => ({ useBilling }))
vi.mock("@/hooks/use-usage", () => ({
  useUsage: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <div>Breadcrumbs</div>,
}))
vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
  ),
}))

const tMap: Record<string, string> = {
  "billing.usage.page.title": "Usage Details",
  "billing.usage.page.description": "Monitor resource usage against your plan limits.",
  "billing.usage.stat.employees": "Active Employees",
  "billing.usage.stat.branches": "Branches",
  "billing.usage.stat.clients": "Clients",
  "billing.usage.stat.bookings": "Bookings this month",
  "billing.usage.stat.unlimited": "∞",
  "billing.usage.stat.na": "—",
  "billing.usage.heading": "Usage limits",
  "billing.usage.bookings": "Bookings this month",
  "billing.usage.branches": "Branches",
  "billing.usage.employees": "Employees",
  "billing.usage.clients": "Clients",
  "billing.usage.unlimited": "Unlimited",
  "billing.usage.unavailable": "Not available",
  "billing.empty.subscription": "No active subscription.",
  "billing.actions.upgrade": "Upgrade plan",
}

const basePlan = {
  id: "pro",
  slug: "PRO",
  nameEn: "Pro",
  nameAr: "محترف",
  priceMonthly: "199",
  priceAnnual: "1999",
  currency: "SAR",
  limits: { maxEmployees: 10, maxBranches: 5, maxClients: 200, maxBookingsPerMonth: 500 },
  sortOrder: 2,
}

const baseSubscription = {
  id: "sub-1",
  organizationId: "org-1",
  status: "ACTIVE" as const,
  billingCycle: "MONTHLY" as const,
  currentPeriodStart: "2026-04-01T00:00:00.000Z",
  currentPeriodEnd: "2026-05-01T00:00:00.000Z",
  plan: basePlan,
  usage: { EMPLOYEES: 3, BRANCHES: 2, CLIENTS: 50, MONTHLY_BOOKINGS: 128 },
  invoices: [],
}

beforeEach(() => {
  useLocale.mockReturnValue({
    locale: "en",
    t: (key: string) => tMap[key] ?? key,
  })
})

describe("BillingUsagePage", () => {
  it("renders StatsGrid with employee/branch/client/bookings values", () => {
    useBilling.mockReturnValue({ subscription: baseSubscription, isLoading: false })

    render(<BillingUsagePage />)

    expect(screen.getByText("Active Employees")).toBeInTheDocument()
    expect(screen.getAllByText("3 / 10").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Branches").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2 / 5").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Clients").length).toBeGreaterThan(0)
    expect(screen.getAllByText("50 / 200").length).toBeGreaterThan(0)
    expect(screen.getByText("Bookings this month")).toBeInTheDocument()
    expect(screen.getAllByText("128 / 500").length).toBeGreaterThan(0)
  })

  it("shows unlimited label when limit is -1", () => {
    const unlimitedSubscription = {
      ...baseSubscription,
      plan: {
        ...basePlan,
        limits: { maxEmployees: -1, maxBranches: -1, maxClients: -1, maxBookingsPerMonth: -1 },
      },
      usage: { EMPLOYEES: 7, BRANCHES: 1, CLIENTS: 30, MONTHLY_BOOKINGS: 50 },
    }
    useBilling.mockReturnValue({ subscription: unlimitedSubscription, isLoading: false })

    render(<BillingUsagePage />)

    const unlimitedValues = screen.getAllByText("7 / ∞")
    expect(unlimitedValues.length).toBeGreaterThan(0)
  })

  it("shows skeleton when isLoading is true", () => {
    useBilling.mockReturnValue({ subscription: null, isLoading: true })

    const { container } = render(<BillingUsagePage />)

    // Skeletons render as divs with animate-pulse; check no stat values rendered
    expect(screen.queryByText("Active Employees")).not.toBeInTheDocument()
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0)
  })

  it("shows empty state when subscription is null", () => {
    useBilling.mockReturnValue({ subscription: null, isLoading: false })

    render(<BillingUsagePage />)

    expect(screen.getByText("No active subscription.")).toBeInTheDocument()
    expect(screen.getByText("Upgrade plan")).toBeInTheDocument()
  })
})
