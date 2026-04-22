/**
 * TenantSwitcher — unit tests (SaaS-06)
 *
 * Covers:
 *  1. Renders nothing when user has 0 or 1 membership
 *  2. Renders a dropdown trigger labeled with the active org's nameAr (ar)
 *     and nameEn (en) when the user has >1 membership
 *  3. Does not render when the user is unauthenticated
 */

import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"

/* ─── Hoisted mocks ─── */

const mockUseMemberships = vi.hoisted(() => vi.fn())
const mockUseSwitchOrg = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())
const mockUseLocale = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-memberships", () => ({
  useMemberships: mockUseMemberships,
}))
vi.mock("@/hooks/use-switch-organization", () => ({
  useSwitchOrganization: mockUseSwitchOrg,
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: mockUseAuth,
}))
vi.mock("@/components/locale-provider", () => ({
  useLocale: mockUseLocale,
}))

import { TenantSwitcher } from "@/components/tenant-switcher"

/* ─── Helpers ─── */

const orgA = {
  id: "m-a",
  organizationId: "org-a",
  role: "OWNER",
  isActive: true,
  organization: {
    id: "org-a",
    slug: "clinic-a",
    nameAr: "العيادة أ",
    nameEn: "Clinic A",
    status: "ACTIVE",
  },
}

const orgB = {
  id: "m-b",
  organizationId: "org-b",
  role: "ADMIN",
  isActive: true,
  organization: {
    id: "org-b",
    slug: "clinic-b",
    nameAr: "العيادة ب",
    nameEn: "Clinic B",
    status: "ACTIVE",
  },
}

function setLocale(locale: "ar" | "en") {
  mockUseLocale.mockReturnValue({
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    toggleLocale: vi.fn(),
    t: (k: string) =>
      (
        {
          "tenantSwitcher.selectOrg": "اختر العيادة",
          "tenantSwitcher.switchOrg": "تبديل العيادة",
          "tenantSwitcher.switching": "جاري التبديل…",
          "tenantSwitcher.switchFailed": "تعذّر تبديل العيادة",
        } as Record<string, string>
      )[k] ?? k,
  })
}

describe("TenantSwitcher", () => {
  beforeEach(() => {
    mockUseSwitchOrg.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    setLocale("ar")
  })

  it("renders nothing when user has only 1 membership", () => {
    mockUseMemberships.mockReturnValue({ data: [orgA], isLoading: false })
    const { container } = render(<TenantSwitcher />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when user is unauthenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseMemberships.mockReturnValue({
      data: [orgA, orgB],
      isLoading: false,
    })
    const { container } = render(<TenantSwitcher />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing while memberships are still loading", () => {
    mockUseMemberships.mockReturnValue({ data: undefined, isLoading: true })
    const { container } = render(<TenantSwitcher />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the active org's Arabic name in ar locale", () => {
    mockUseMemberships.mockReturnValue({
      data: [orgA, orgB],
      isLoading: false,
    })
    render(<TenantSwitcher />)
    expect(screen.getByRole("button")).toHaveTextContent("العيادة أ")
  })

  it("renders the active org's English name in en locale", () => {
    setLocale("en")
    mockUseMemberships.mockReturnValue({
      data: [orgA, orgB],
      isLoading: false,
    })
    render(<TenantSwitcher />)
    expect(screen.getByRole("button")).toHaveTextContent("Clinic A")
  })
})
