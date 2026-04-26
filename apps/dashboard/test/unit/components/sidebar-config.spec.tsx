import { describe, expect, it } from "vitest"

import {
  overviewNav,
  organizationNav,
  financeNav,
  toolsNav,
  adminNav,
  navGroups,
} from "@/components/sidebar-config"
// Sidebar nav uses the tiered FeatureKey enum (single source of truth for
// billing-gated features) rather than the legacy FEATURE_FLAG_KEYS list.
import { FeatureKey } from "@carekit/shared/constants"

const ALL_FEATURE_KEYS = Object.values(FeatureKey) as readonly string[]

describe("SidebarConfig — groups added", () => {
  // Collect every nav item href from all nav groups
  const allNavItems = [
    ...overviewNav,
    ...organizationNav,
    ...financeNav,
    ...toolsNav,
    ...adminNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("does not contain a /groups nav item (groups feature removed)", () => {
    const groupsItem = organizationNav.find((item) => item.href === "/groups")
    expect(groupsItem).toBeUndefined()
  })

  it("each nav item with featureFlag uses a key from FeatureKey", () => {
    const itemsWithFlag = allNavItems.filter((item) => item.featureFlag !== undefined)
    for (const item of itemsWithFlag) {
      expect(ALL_FEATURE_KEYS).toContain(item.featureFlag)
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
      "nav.organization",
      "nav.finance",
      "nav.tools",
      "nav.admin",
    ])
  })

  it("organizationNav contains expected items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/clients")
    expect(allHrefs).toContain("/employees")
    expect(allHrefs).toContain("/branches")
  })

  it("featureFlag keys are correct for all gated items", () => {
    // branches → branches (FeatureKey.BRANCHES)
    const branches = organizationNav.find((i) => i.href === "/branches")
    expect(branches?.featureFlag).toBe(FeatureKey.BRANCHES)

    // intakeForms → intake_forms (FeatureKey.INTAKE_FORMS)
    const intakeForms = organizationNav.find((i) => i.href === "/intake-forms")
    expect(intakeForms?.featureFlag).toBe(FeatureKey.INTAKE_FORMS)

    // coupons → coupons (FeatureKey.COUPONS)
    const coupons = financeNav.find((i) => i.href === "/coupons")
    expect(coupons?.featureFlag).toBe(FeatureKey.COUPONS)

    // chatbot → ai_chatbot (FeatureKey.AI_CHATBOT)
    const chatbot = toolsNav.find((i) => i.href === "/chatbot")
    expect(chatbot?.featureFlag).toBe(FeatureKey.AI_CHATBOT)
  })
})
