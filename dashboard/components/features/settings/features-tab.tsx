"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeatureFlags, useFeatureFlagMutation } from "@/hooks/use-feature-flags"
import type { FeatureFlag } from "@/lib/types/feature-flag"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"

const FEATURE_ICONS: Record<string, string> = {
  waitlist: "clock",
  coupons: "ticket",
  gift_cards: "gift",
  intake_forms: "clipboard",
  chatbot: "bot",
  live_chat: "headset",
  ratings: "star",
  multi_branch: "building",
  recurring: "repeat",
  walk_in: "footprints",
}

export function FeaturesTab() {
  const { t, locale } = useLocale()
  const { flags, isLoading } = useFeatureFlags()
  const { toggleMut } = useFeatureFlagMutation()

  const handleToggle = (key: string, enabled: boolean) => {
    toggleMut.mutate(
      { key, enabled },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error") ?? "Failed to update"),
      },
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {t("settings.features.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("settings.features.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {flags.map((flag: FeatureFlag, index: number) => (
          <div key={flag.id}>
            {index > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div className="flex-1 pe-4">
                <p className="text-sm font-medium text-foreground">
                  {locale === "ar" ? flag.nameAr : flag.nameEn}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === "ar" ? flag.descriptionAr : flag.descriptionEn}
                </p>
              </div>
              <Switch
                checked={flag.enabled}
                onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                disabled={toggleMut.isPending}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
