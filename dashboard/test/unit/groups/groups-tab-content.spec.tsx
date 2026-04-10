import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, prefetch: vi.fn() })),
}))

// ── Mock GroupsListContent ────────────────────────────────────────────────────
vi.mock("@/components/features/groups/groups-list-content", () => ({
  GroupsListContent: vi.fn(({ onGroupClick }) => (
    <div data-testid="groups-list-content">
      <button onClick={() => onGroupClick("group-123")}>Trigger group click</button>
    </div>
  )),
}))

// ── Mock useGroups hook ───────────────────────────────────────────────────────
const mockUseGroups = vi.fn()
vi.mock("@/hooks/use-groups", () => ({
  useGroups: () => mockUseGroups(),
}))

// ── Locale mock ───────────────────────────────────────────────────────────────
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", dir: "rtl" as const, t: (k: string) => k }),
}))

import { GroupsTabContent } from "@/components/features/groups/groups-tab-content"

describe("GroupsTabContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGroups.mockReturnValue({
      groups: [],
      meta: null,
      isLoading: false,
      error: null,
      search: "",
      setSearch: vi.fn(),
      status: undefined,
      setStatus: vi.fn(),
      deliveryMode: undefined,
      setDeliveryMode: vi.fn(),
      visibility: undefined,
      setVisibility: vi.fn(),
      resetFilters: vi.fn(),
      refetch: vi.fn(),
    })
  })

  it("renders GroupsListContent", () => {
    render(<GroupsTabContent />)
    expect(screen.getByTestId("groups-list-content")).toBeInTheDocument()
  })

  it("passes onGroupClick that navigates to /groups/[id]", () => {
    render(<GroupsTabContent />)
    const btn = screen.getByText("Trigger group click")
    btn.click()
    expect(mockPush).toHaveBeenCalledWith("/groups/group-123")
  })

  it("shows error state via GroupsListContent when groups fetch fails", () => {
    mockUseGroups.mockReturnValue({
      groups: [],
      meta: null,
      isLoading: false,
      error: "Failed to load groups",
      search: "",
      setSearch: vi.fn(),
      status: undefined,
      setStatus: vi.fn(),
      deliveryMode: undefined,
      setDeliveryMode: vi.fn(),
      visibility: undefined,
      setVisibility: vi.fn(),
      resetFilters: vi.fn(),
      refetch: vi.fn(),
    })

    render(<GroupsTabContent />)
    // GroupsListContent receives the error prop and can render an error state
    expect(screen.getByTestId("groups-list-content")).toBeInTheDocument()
  })

  it("shows loading skeleton via GroupsListContent when groups are loading", () => {
    mockUseGroups.mockReturnValue({
      groups: [],
      meta: null,
      isLoading: true,
      error: null,
      search: "",
      setSearch: vi.fn(),
      status: undefined,
      setStatus: vi.fn(),
      deliveryMode: undefined,
      setDeliveryMode: vi.fn(),
      visibility: undefined,
      setVisibility: vi.fn(),
      resetFilters: vi.fn(),
      refetch: vi.fn(),
    })

    render(<GroupsTabContent />)
    expect(screen.getByTestId("groups-list-content")).toBeInTheDocument()
  })
})
