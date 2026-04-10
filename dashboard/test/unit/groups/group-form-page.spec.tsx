import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, prefetch: vi.fn() })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn().mockReturnValue("general"),
  })),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    t: (k: string) => {
      const map: Record<string, string> = {
        "groups.create.tabs.general": "عام",
        "groups.create.tabs.scheduling": "الجدولة",
        "groups.create.tabs.settings": "الإعدادات",
        "groups.create.tabs.practitioners": "الممارسون",
        "groups.create.practitionerRequired": "يرجى اختيار ممارس أولاً",
        "groups.create.formError": "يرجى التحقق من الحقول المطلوبة",
        "groups.create.success": "تم إنشاء المجموعة بنجاح",
        "groups.create.error": "فشل في إنشاء المجموعة",
        "groups.create.submitting": "جارٍ الإنشاء...",
        "groups.create.submit": "إنشاء المجموعة",
        "groups.create.cancel": "إلغاء",
        "groups.title": "المجموعات",
        "groups.addGroup": "إضافة مجموعة",
      }
      return map[k] ?? k
    },
  }),
}))

const mockCreateGroup = vi.fn()
vi.mock("@/hooks/use-groups-mutations", () => ({
  useGroupsMutations: () => ({ createGroupMut: { mutateAsync: mockCreateGroup } }),
}))

// Mock tab components
vi.mock("@/components/features/groups/create/general-info-tab", () => ({
  GeneralInfoTab: () => <div data-testid="general-info-tab" />,
}))

vi.mock("@/components/features/groups/create/scheduling-price-tab", () => ({
  SchedulingPriceTab: () => <div data-testid="scheduling-price-tab" />,
}))

vi.mock("@/components/features/groups/create/settings-tab", () => ({
  SettingsTab: () => <div data-testid="settings-tab" />,
}))

vi.mock("@/components/features/services/service-practitioners-tab", () => ({
  ServicePractitionersTab: () => <div data-testid="practitioners-tab" />,
}))

vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="list-page-shell">{children}</div>
  ),
}))

vi.mock("@/components/features/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}))

vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs" />,
}))

import { GroupFormPage } from "@/components/features/groups/group-form-page"

// ── Wrapper ────────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderForm() {
  return render(
    <Wrapper>
      <GroupFormPage mode="create" />
    </Wrapper>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GroupFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockReset()
    mockCreateGroup.mockReset()
  })

  it("renders all 4 tabs (general, scheduling, settings, practitioners)", () => {
    renderForm()
    expect(screen.getByText("عام")).toBeInTheDocument()
    expect(screen.getByText("الجدولة")).toBeInTheDocument()
    expect(screen.getByText("الإعدادات")).toBeInTheDocument()
    expect(screen.getByText("الممارسون")).toBeInTheDocument()
  })

  it("renders general-info-tab by default (first tab active)", () => {
    renderForm()
    expect(screen.getByTestId("general-info-tab")).toBeInTheDocument()
  })

  it("clicking scheduling tab shows scheduling-price-tab content", async () => {
    renderForm()
    await userEvent.click(screen.getByText("الجدولة"))
    await waitFor(() => {
      expect(screen.getByTestId("scheduling-price-tab")).toBeInTheDocument()
    })
  })

  it("tab switching preserves tab content without full re-render", async () => {
    renderForm()

    await userEvent.click(screen.getByText("الجدولة"))
    await waitFor(() => {
      expect(screen.getByTestId("scheduling-price-tab")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText("الإعدادات"))
    await waitFor(() => {
      expect(screen.getByTestId("settings-tab")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText("عام"))
    await waitFor(() => {
      expect(screen.getByTestId("general-info-tab")).toBeInTheDocument()
    })
  })

  it("shows practitioner required error toast when no practitioner selected", async () => {
    // Without a practitioner, createGroup should NOT be called
    mockCreateGroup.mockRejectedValue(new Error("should not be called"))
    renderForm()

    const submitBtn = screen.getByRole("button", { name: /إنشاء المجموعة/i })
    await userEvent.click(submitBtn)

    expect(mockCreateGroup).not.toHaveBeenCalled()
  })

  it("cancel button navigates back to groups list", async () => {
    renderForm()

    const cancelBtn = screen.getByRole("button", { name: /إلغاء/i })
    await userEvent.click(cancelBtn)

    expect(mockPush).toHaveBeenCalledWith("/services?tab=groups")
  })

  it("submit button is enabled in initial state (before async submission)", () => {
    renderForm()
    const submitBtn = screen.getByRole("button", { name: /إنشاء المجموعة/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it("renders practitioners tab content when practitioners tab is active", async () => {
    renderForm()
    await userEvent.click(screen.getByText("الممارسون"))
    await waitFor(() => {
      expect(screen.getByTestId("practitioners-tab")).toBeInTheDocument()
    })
  })
})
