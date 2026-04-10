import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ── Mock next/navigation — must include ALL exports Breadcrumbs uses ──────────
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: vi.fn(() => ({ push: mockPush, prefetch: vi.fn() })),
    usePathname: vi.fn(() => "/services"),
    useSearchParams: vi.fn(() => new URLSearchParams()),
  }
})

const mockPush = vi.fn()

// ── Mock API ─────────────────────────────────────────────────────────────────
vi.mock("@/lib/api/services", () => ({
  exportServicesCsv: vi.fn(),
  exportServicesExcel: vi.fn(),
}))

vi.mock("@/lib/api/license", () => ({
  fetchLicenseFeatures: vi.fn().mockResolvedValue({ features: [] }),
}))

// ── Mock child components ────────────────────────────────────────────────────
vi.mock("@/components/features/services/services-tab-content", () => ({
  ServicesTabContent: () => <div data-testid="services-tab-content">ServicesTabContent</div>,
}))
vi.mock("@/components/features/services/categories-tab-content", () => ({
  CategoriesTabContent: () => <div data-testid="categories-tab-content">CategoriesTabContent</div>,
}))
vi.mock("@/components/features/departments/departments-tab-content", () => ({
  DepartmentsTabContent: () => <div data-testid="departments-tab-content">DepartmentsTabContent</div>,
}))
vi.mock("@/components/features/groups/groups-tab-content", () => ({
  GroupsTabContent: () => <div data-testid="groups-tab-content">GroupsTabContent</div>,
}))
vi.mock("@/components/features/services/create-category-dialog", () => ({
  CreateCategoryDialog: () => <div data-testid="create-category-dialog">CreateCategoryDialog</div>,
}))

// ── Locale mock ───────────────────────────────────────────────────────────────
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => k,
  }),
}))

import ServicesPage from "@/app/(dashboard)/services/page"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return Wrapper
}

describe("ServicesPage — groups tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders groups TabsTrigger", async () => {
    render(<ServicesPage />, { wrapper: makeWrapper() })
    expect(screen.getByRole("tab", { name: /services\.tabs\.groups/i })).toBeInTheDocument()
  })

  it("renders GroupsTabContent when groups tab is active", async () => {
    render(<ServicesPage />, { wrapper: makeWrapper() })

    const groupsTab = screen.getByRole("tab", { name: /services\.tabs\.groups/i })
    await userEvent.click(groupsTab)

    expect(screen.getByTestId("groups-tab-content")).toBeInTheDocument()
  })

  it("handleAddClick with activeTab=groups calls router.push(/groups/create)", async () => {
    render(<ServicesPage />, { wrapper: makeWrapper() })

    // Click the groups tab first to activate it
    const groupsTab = screen.getByRole("tab", { name: /services\.tabs\.groups/i })
    await userEvent.click(groupsTab)

    // Now click the add button — it should use the groups label
    const addButton = screen.getByRole("button", { name: /groups\.addGroup/i })
    await userEvent.click(addButton)

    expect(mockPush).toHaveBeenCalledWith("/groups/create")
  })

  it("renders other tabs (services, categories, departments) alongside groups", async () => {
    render(<ServicesPage />, { wrapper: makeWrapper() })

    expect(screen.getByRole("tab", { name: /services\.tabs\.services/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /services\.tabs\.categories/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /services\.tabs\.departments/i })).toBeInTheDocument()
  })
})
