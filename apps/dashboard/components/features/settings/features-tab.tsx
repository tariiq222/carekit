"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useFeatureFlags, useFeatureFlagMutation } from "@/hooks/use-feature-flags"
import { useLicenseFeatures } from "@/hooks/use-license"
import type { FeatureFlag } from "@/lib/types/feature-flag"
import type { FeatureWithStatus } from "@/lib/types/license"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import { useState } from "react"

export function FeaturesTab() {
  const { t, locale } = useLocale()
  const { flags, isLoading: flagsLoading } = useFeatureFlags()
  const { data: licenseFeatures, isLoading: licenseLoading } = useLicenseFeatures()
  const { toggleMut } = useFeatureFlagMutation()
  const [activeFlag, setActiveFlag] = useState<string | null>(null)

  const isLoading = flagsLoading || licenseLoading

  const licenseMap = new Map<string, FeatureWithStatus>()
  if (licenseFeatures) {
    for (const f of licenseFeatures) {
      licenseMap.set(f.key, f)
    }
  }

  const handleToggle = (key: string, enabled: boolean) => {
    toggleMut.mutate(
      { key, enabled },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  const selectedFlag = flags.find((f: FeatureFlag) => f.key === activeFlag) ?? flags[0] ?? null
  const displayFlag = selectedFlag
  const displayLicense = displayFlag ? licenseMap.get(displayFlag.key) : null

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.features.title")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {flags.map((flag: FeatureFlag) => {
              const isActive = (activeFlag ?? flags[0]?.key) === flag.key
              const license = licenseMap.get(flag.key)
              const isLicensed = license?.licensed ?? true
              return (
                <div
                  key={flag.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => setActiveFlag(flag.key)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveFlag(flag.key) }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">
                      {locale === "ar" ? flag.nameAr : flag.nameEn}
                    </p>
                    {!isLicensed && (
                      <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0 border-warning/50 text-warning">
                        {locale === "ar" ? "غير مرخّص" : "Not licensed"}
                      </Badge>
                    )}
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    {isLicensed ? (
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                        disabled={toggleMut.isPending}
                      />
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={false}
                                disabled
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">هذه الميزة غير متاحة في رخصتك</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {displayFlag ? (
            <div className="flex flex-col gap-3 h-full">
              <Card className="shadow-sm bg-surface">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">
                          {locale === "ar" ? displayFlag.nameAr : displayFlag.nameEn}
                        </p>
                        {displayLicense && (
                          <Badge
                            variant={displayLicense.licensed ? "default" : "destructive"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {displayLicense.licensed
                              ? (locale === "ar" ? "مرخّص" : "Licensed")
                              : (locale === "ar" ? "غير مرخّص" : "Not licensed")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {locale === "ar" ? displayFlag.descriptionAr : displayFlag.descriptionEn}
                      </p>
                    </div>
                    {(displayLicense?.licensed ?? true) ? (
                      <Switch
                        checked={displayFlag.enabled}
                        onCheckedChange={(checked) => handleToggle(displayFlag.key, checked)}
                        disabled={toggleMut.isPending}
                      />
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch checked={false} disabled />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">هذه الميزة غير متاحة في رخصتك</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-surface">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      displayFlag.enabled ? "bg-success" : "bg-muted-foreground"
                    )} />
                    <p className="text-sm text-muted-foreground">
                      {displayFlag.enabled
                        ? t("settings.features.enabled")
                        : t("settings.features.disabled")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("settings.features.description")}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
