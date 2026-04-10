import { describe, expect, it } from "vitest"

import {
  overviewNav,
  clinicNav,
  financeNav,
  toolsNav,
  adminNav,
  navGroups,
} from "@/components/sidebar-config"

describe("SidebarConfig — groups removed", () => {
  // Collect every nav item href from all nav groups
  const allHrefs = [
    ...overviewNav,
    ...clinicNav,
    ...financeNav,
    ...toolsNav,
    ...adminNav,
  ].map((item) => item.href)

  it("does NOT contain a /groups nav item", () => {
    expect(allHrefs).not.toContain("/groups")
  })

  it("still contains other clinic nav items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/patients")
    expect(allHrefs).toContain("/practitioners")
    expect(allHrefs).toContain("/branches")
  })

  it("navGroups has all 5 sections", () => {
    expect(navGroups).toHaveLength(5)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.overview",
      "nav.clinic",
      "nav.finance",
      "nav.tools",
      "nav.admin",
    ])
  })
})
