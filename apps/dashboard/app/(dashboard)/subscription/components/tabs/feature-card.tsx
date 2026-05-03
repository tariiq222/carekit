"use client"

import { CheckmarkCircle02Icon, LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button, Card, CardContent } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { FeatureCatalogEntry } from "@deqah/shared/constants"
import type { FeatureEntry } from "@deqah/shared"

interface FeatureCardProps {
  catalog: FeatureCatalogEntry
  entry: FeatureEntry | undefined
  onUpgrade: () => void
}

function getUsageBarColor(ratio: number): string {
  if (ratio >= 0.9) return "bg-error"
  if (ratio >= 0.75) return "bg-warning"
  return "bg-success"
}

function getUsageBarTrack(ratio: number): string {
  if (ratio >= 0.9) return "bg-error/20"
  if (ratio >= 0.75) return "bg-warning/20"
  return "bg-success/20"
}

export function FeatureCard({ catalog, entry, onUpgrade }: FeatureCardProps) {
  const { t, locale } = useLocale()

  const isEnabled = entry?.enabled ?? false
  const name = locale === "ar" ? catalog.nameAr : catalog.nameEn
  const description = locale === "ar" ? catalog.descAr : catalog.descEn

  const showUsage =
    isEnabled && catalog.kind === "quantitative" && entry !== undefined

  const limit = entry?.limit ?? -1
  const currentCount = entry?.currentCount ?? 0
  const isUnlimited = limit === -1

  const ratio = !isUnlimited && limit > 0 ? currentCount / limit : 0

  const usageLabel = isUnlimited
    ? t("billing.features.usageUnlimited").replace("{current}", String(currentCount))
    : t("billing.features.usage")
        .replace("{current}", String(currentCount))
        .replace("{max}", String(limit))

  const tierKey =
    catalog.tier === "ENTERPRISE"
      ? "billing.features.status.lockedEnterprise"
      : "billing.features.status.lockedPro"

  return (
    <Card className={cn("transition-opacity", !isEnabled && "opacity-75")}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-md",
                isEnabled
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <HugeiconsIcon
                icon={isEnabled ? CheckmarkCircle02Icon : LockIcon}
                strokeWidth={1.8}
                className="size-4"
              />
            </div>
            <p className="text-sm font-medium text-foreground">{name}</p>
          </div>

          {isEnabled ? (
            <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              {t("billing.features.status.enabled")}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={onUpgrade}
            >
              {t("billing.features.upgradeButton")}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{description}</p>

        {!isEnabled && (
          <p className="text-xs text-muted-foreground">{t(tierKey)}</p>
        )}

        {showUsage && (
          <div className="space-y-1.5">
            <div className={cn("h-1.5 w-full overflow-hidden rounded-full", getUsageBarTrack(ratio))}>
              <div
                className={cn("h-full rounded-full transition-all", getUsageBarColor(ratio))}
                style={{ width: isUnlimited ? "0%" : `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{usageLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
