/**
 * Feature Flags constants — shared package tests
 *
 * FEATURE_FLAG_KEYS must contain exactly 14 keys and the FeatureFlagKey
 * type must be exhaustive for all known feature flags.
 */

import { describe, expect, it } from "vitest"
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@carekit/shared/constants"

describe("FEATURE_FLAG_KEYS", () => {
  it("contains exactly 13 keys", () => {
    expect(FEATURE_FLAG_KEYS).toHaveLength(13)
  })

  it("contains all required keys", () => {
    const required = [
      "coupons",
      "intake_forms",
      "chatbot",
      "ratings",
      "multi_branch",
      "reports",
      "recurring",
      "walk_in",
      "waitlist",
      "zoom",
      "zatca",
      "departments",
      "groups",
    ] as const

    for (const key of required) {
      expect(FEATURE_FLAG_KEYS).toContain(key)
    }
  })

  it("does not contain duplicate keys", () => {
    const seen = new Set<string>()
    for (const key of FEATURE_FLAG_KEYS) {
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe("FeatureFlagKey type exhaustiveness", () => {
  it('includes "groups" as a valid FeatureFlagKey', () => {
    const key: FeatureFlagKey = "groups"
    expect(FEATURE_FLAG_KEYS).toContain(key)
  })

  it('includes "zoom" as a valid FeatureFlagKey', () => {
    const key: FeatureFlagKey = "zoom"
    expect(FEATURE_FLAG_KEYS).toContain(key)
  })

  it('includes "departments" as a valid FeatureFlagKey', () => {
    const key: FeatureFlagKey = "departments"
    expect(FEATURE_FLAG_KEYS).toContain(key)
  })

  it('includes "walk_in" as a valid FeatureFlagKey', () => {
    const key: FeatureFlagKey = "walk_in"
    expect(FEATURE_FLAG_KEYS).toContain(key)
  })

  it('includes "waitlist" as a valid FeatureFlagKey', () => {
    const key: FeatureFlagKey = "waitlist"
    expect(FEATURE_FLAG_KEYS).toContain(key)
  })

  it("FeatureFlagKey type covers all FEATURE_FLAG_KEYS values", () => {
    // This is a compile-time check — if FEATURE_FLAG_KEYS and FeatureFlagKey
    // ever drift, TypeScript will error here.
    const checkType = (key: FeatureFlagKey) => key
    for (const key of FEATURE_FLAG_KEYS) {
      checkType(key)
    }
  })
})
