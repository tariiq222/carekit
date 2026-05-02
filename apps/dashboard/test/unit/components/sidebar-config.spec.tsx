import { describe, expect, it } from "vitest"

import {
  overviewNav,
  operationsNav,
  peopleNav,
  financeNav,
  catalogNav,
  systemNav,
  navGroups,
} from "@/components/sidebar-config"
// Sidebar nav uses the tiered FeatureKey enum (single source of truth for
// billing-gated features) rather than the legacy FEATURE_FLAG_KEYS list.
import { FeatureKey } from "@deqah/shared/constants"

const ALL_FEATURE_KEYS = Object.values(FeatureKey) as readonly string[]

describe("SidebarConfig — groups added", () => {
  // Collect every nav item href from all nav groups
  const allNavItems = [
    ...overviewNav,
    ...operationsNav,
    ...peopleNav,
    ...financeNav,
    ...catalogNav,
    ...systemNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

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

  it("navGroups has all 6 sections", () => {
    expect(navGroups).toHaveLength(6)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.overview",
      "nav.operations",
      "nav.people",
      "nav.finance",
      "nav.catalog",
      "nav.system",
    ])
  })

  it("catalogNav contains expected items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/categories")
    expect(allHrefs).toContain("/departments")
    expect(allHrefs).toContain("/branches")
    expect(allHrefs).toContain("/intake-forms")
  })

  it("operationsNav contains expected items", () => {
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/clients")
    expect(allHrefs).toContain("/ratings")
    expect(allHrefs).toContain("/contact-messages")
  })

  it("featureFlag keys are correct for all gated items", () => {
    // branches → FeatureKey.BRANCHES (now in catalogNav)
    const branches = catalogNav.find((i) => i.href === "/branches")
    expect(branches?.featureFlag).toBe(FeatureKey.BRANCHES)

    // intakeForms → FeatureKey.INTAKE_FORMS (now in catalogNav)
    const intakeForms = catalogNav.find((i) => i.href === "/intake-forms")
    expect(intakeForms?.featureFlag).toBe(FeatureKey.INTAKE_FORMS)

    // coupons → FeatureKey.COUPONS (financeNav)
    const coupons = financeNav.find((i) => i.href === "/coupons")
    expect(coupons?.featureFlag).toBe(FeatureKey.COUPONS)

    // chatbot → FeatureKey.AI_CHATBOT (now in systemNav)
    const chatbot = systemNav.find((i) => i.href === "/chatbot")
    expect(chatbot?.featureFlag).toBe(FeatureKey.AI_CHATBOT)
  })
})
