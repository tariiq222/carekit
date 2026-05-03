"use client"

import { useMemo } from "react"
import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useBillingFeatures } from "@/hooks/use-billing-features"
import { FEATURE_CATALOG } from "@deqah/shared/constants"
import type { FeatureGroup } from "@deqah/shared/constants"
import { FeatureGroupSection } from "./feature-group-section"

const GROUPS: FeatureGroup[] = [
  "Booking & Scheduling",
  "Client Engagement",
  "Finance & Compliance",
  "Operations",
  "Platform",
]

interface FeaturesTabProps {
  onSwitchToPlans: () => void
}

export function FeaturesTab({ onSwitchToPlans }: FeaturesTabProps) {
  const { t } = useLocale()
  const { data, isLoading } = useBillingFeatures()

  const planSlug = data?.planSlug ?? ""
  const features = data?.features ?? {}

  const groupedEntries = useMemo(() => {
    const allEntries = Object.values(FEATURE_CATALOG)
    return GROUPS.map((group) => ({
      group,
      entries: allEntries.filter((e) => e.group === group),
    }))
  }, [])

  const showUpgradeBanner = planSlug !== "" && planSlug.toUpperCase() !== "ENTERPRISE"

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showUpgradeBanner && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-foreground">
            {t("billing.features.upgradeBanner.title")}
          </p>
          <Button size="sm" variant="outline" onClick={onSwitchToPlans}>
            {t("billing.features.upgradeBanner.cta")}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {groupedEntries.map(({ group, entries }) => (
          <FeatureGroupSection
            key={group}
            group={group}
            entries={entries}
            features={features}
            onUpgrade={onSwitchToPlans}
          />
        ))}
      </div>
    </div>
  )
}
