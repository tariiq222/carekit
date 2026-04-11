import { describe, expect, it } from "vitest"

import {
  overviewNav,
  clinicNav,
  financeNav,
  toolsNav,
  adminNav,
  navGroups,
} from "@/components/sidebar-config"
import { FEATURE_FLAG_KEYS } from "@carekit/shared/constants"

describe("SidebarConfig — groups added", () => {
  // Collect every nav item href from all nav groups
  const allNavItems = [
    ...overviewNav,
    ...clinicNav,
    ...financeNav,
    ...toolsNav,
    ...adminNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("contains /groups nav item in clinicNav with featureFlag: groups", () => {
    const groupsItem = clinicNav.find((item) => item.href === "/groups")
    expect(groupsItem).toBeDefined()
    expect(groupsItem?.featureFlag).toBe("groups")
  })

  it("each nav item with featureFlag uses a key from FEATURE_FLAG_KEYS", () => {
    const itemsWithFlag = allNavItems.filter((item) => item.featureFlag !== undefined)
    for (const item of itemsWithFlag) {
      expect(FEATURE_FLAG_KEYS).toContain(item.featureFlag)
    }
  })

  it("no duplicate hrefs across all nav items", () => {
    const duplicates = allHrefs.filter((href, i) => allHrefs.indexOf(href) !== i)
    expect(duplicates).toHaveLength(0)
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

  it("clinicNav contains expected items including groups", () => {
    expect(allHrefs).toContain("/groups")
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/patients")
    expect(allHrefs).toContain("/practitioners")
    expect(allHrefs).toContain("/branches")
  })

  it("featureFlag keys are correct for all gated items", () => {
    // branches → multi_branch
    const branches = clinicNav.find((i) => i.href === "/branches")
    expect(branches?.featureFlag).toBe("multi_branch")

    // intakeForms → intake_forms
    const intakeForms = clinicNav.find((i) => i.href === "/intake-forms")
    expect(intakeForms?.featureFlag).toBe("intake_forms")

    // coupons → coupons
    const coupons = financeNav.find((i) => i.href === "/coupons")
    expect(coupons?.featureFlag).toBe("coupons")

    // reports → reports
    const reports = financeNav.find((i) => i.href === "/reports")
    expect(reports?.featureFlag).toBe("reports")

    // chatbot → chatbot
    const chatbot = toolsNav.find((i) => i.href === "/chatbot")
    expect(chatbot?.featureFlag).toBe("chatbot")
  })
})
