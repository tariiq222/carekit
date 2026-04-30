"use client"

import type { BillingCycle, Plan, Subscription, SubscriptionStatus } from "@/lib/types/billing"

export interface BillingUsageSummary {
  current: number | null
  max: number | null
  ratio: number
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function getLocalizedPlanName(plan: Plan | null | undefined, locale: "ar" | "en") {
  if (!plan) return ""
  return locale === "ar" ? plan.nameAr : plan.nameEn
}

export function getFeatureLimit(
  limits: Record<string, number | boolean>,
  feature: string,
): number | boolean | undefined {
  return limits[feature] ?? limits[`${feature}Enabled`]
}

export function isFeatureEnabledForBilling(args: {
  limits: Record<string, number | boolean>
  feature: string
  status: SubscriptionStatus | null
}) {
  const { limits, feature, status } = args
  if (status === "SUSPENDED") return false
  if (status !== "ACTIVE" && status !== "TRIALING") return false

  const value = getFeatureLimit(limits, feature)
  if (value === undefined) return true
  if (typeof value === "boolean") return value
  return value > 0
}

export function getUsageValue(
  usage: Partial<Record<string, number>> | undefined,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = readNumber(usage?.[key])
    if (value !== null) return value
  }

  return null
}

export function getBillingUsageSummary(subscription: Subscription | null | undefined): BillingUsageSummary {
  const current = getUsageValue(subscription?.usage, [
    "BOOKINGS",
    "BOOKINGS_PER_MONTH",
    "bookings",
    "bookingsPerMonth",
  ])

  const max = readNumber(subscription?.plan?.limits?.maxBookingsPerMonth)

  if (current === null || max === null || max <= 0) {
    return { current, max, ratio: 0 }
  }

  return {
    current,
    max,
    ratio: Math.max(0, current / max),
  }
}

export function getEmployeeUsageSummary(subscription: Subscription | null | undefined): BillingUsageSummary {
  const current = getUsageValue(subscription?.usage, ["EMPLOYEES", "employees"])
  const max = readNumber(subscription?.plan?.limits?.maxEmployees)

  if (current === null || max === null || max <= 0) {
    return { current, max, ratio: 0 }
  }

  return {
    current,
    max,
    ratio: Math.max(0, current / max),
  }
}

export function formatBillingDate(value: string, locale: "ar" | "en") {
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function getBillingCycleLabel(cycle: BillingCycle, locale: "ar" | "en") {
  return locale === "ar"
    ? cycle === "ANNUAL"
      ? "سنوي"
      : "شهري"
    : cycle === "ANNUAL"
      ? "Annual"
      : "Monthly"
}
