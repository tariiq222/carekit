"use client"

import { Card, CardContent } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useFeatureFlags, useFeatureFlagMutation } from "@/hooks/use-feature-flags"
import type { FeatureFlag } from "@/lib/types/feature-flag"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import { useState } from "react"

export function FeaturesTab() {
  const { t, locale } = useLocale()
  const { flags, isLoading } = useFeatureFlags()
  const { toggleMut } = useFeatureFlagMutation()
  const [activeFlag, setActiveFlag] = useState<string | null>(null)

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
                  <p className="text-sm font-medium truncate leading-tight">
                    {locale === "ar" ? flag.nameAr : flag.nameEn}
                  </p>
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="shrink-0">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                      disabled={toggleMut.isPending}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {selectedFlag ? (
            <div className="flex flex-col gap-3 h-full">
              <Card className="shadow-sm bg-surface">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-foreground">
                        {locale === "ar" ? selectedFlag.nameAr : selectedFlag.nameEn}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {locale === "ar" ? selectedFlag.descriptionAr : selectedFlag.descriptionEn}
                      </p>
                    </div>
                    <Switch
                      checked={selectedFlag.enabled}
                      onCheckedChange={(checked) => handleToggle(selectedFlag.key, checked)}
                      disabled={toggleMut.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-surface">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      selectedFlag.enabled ? "bg-success" : "bg-muted-foreground"
                    )} />
                    <p className="text-sm text-muted-foreground">
                      {selectedFlag.enabled
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
