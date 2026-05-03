"use client"

import { useLocale } from "@/components/locale-provider"
import type { FeatureGroup, FeatureCatalogEntry } from "@deqah/shared/constants"
import type { FeatureEntry } from "@deqah/shared"
import { FeatureCard } from "./feature-card"

const GROUP_KEY_MAP: Record<FeatureGroup, string> = {
  "Booking & Scheduling": "billing.features.group.bookingScheduling",
  "Client Engagement": "billing.features.group.clientEngagement",
  "Finance & Compliance": "billing.features.group.financeCompliance",
  "Operations": "billing.features.group.operations",
  "Platform": "billing.features.group.platform",
}

interface FeatureGroupSectionProps {
  group: FeatureGroup
  entries: FeatureCatalogEntry[]
  features: Record<string, FeatureEntry>
  onUpgrade: () => void
}

export function FeatureGroupSection({
  group,
  entries,
  features,
  onUpgrade,
}: FeatureGroupSectionProps) {
  const { t } = useLocale()
  const groupLabel = t(GROUP_KEY_MAP[group])

  return (
    <details className="group" open>
      <summary className="mb-4 flex cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 hover:bg-muted/60">
        <h3 className="text-sm font-semibold text-foreground">{groupLabel}</h3>
        <span className="text-xs text-muted-foreground">
          {entries.filter(e => features[e.key]?.enabled).length} / {entries.length}
        </span>
      </summary>

      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <FeatureCard
            key={entry.key}
            catalog={entry}
            entry={features[entry.key]}
            onUpgrade={onUpgrade}
          />
        ))}
      </div>
    </details>
  )
}
