"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeatureFlags, useFeatureFlagMutation } from "@/hooks/use-feature-flags"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import type { FeatureFlag } from "@/lib/types/feature-flag"

const MODULE_FLAGS = ["coupons", "gift_cards", "intake_forms", "chatbot", "ratings", "multi_branch", "reports"]
const BOOKING_FLAGS = ["recurring", "walk_in", "waitlist", "zoom"]
const COMPLIANCE_FLAGS = ["zatca"]

function FlagRow({ flag, onToggle, isPending, locale }: {
  flag: FeatureFlag
  onToggle: (key: string, enabled: boolean) => void
  isPending: boolean
  locale: string
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 pe-4">
        <p className="text-sm font-medium text-foreground">
          {locale === "ar" ? flag.nameAr : flag.nameEn}
        </p>
        {(locale === "ar" ? flag.descriptionAr : flag.descriptionEn) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {locale === "ar" ? flag.descriptionAr : flag.descriptionEn}
          </p>
        )}
      </div>
      <Switch
        checked={flag.enabled}
        onCheckedChange={(checked) => onToggle(flag.key, checked)}
        disabled={isPending}
      />
    </div>
  )
}

function FlagSection({ title, flags, allFlags, onToggle, isPending, locale }: {
  title: string
  flags: string[]
  allFlags: FeatureFlag[]
  onToggle: (key: string, enabled: boolean) => void
  isPending: boolean
  locale: string
}) {
  const sectionFlags = allFlags.filter((f) => flags.includes(f.key))
  if (sectionFlags.length === 0) return null
  return (
    <div className="space-y-1">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {sectionFlags.map((flag, i) => (
        <div key={flag.key}>
          {i > 0 && <Separator className="my-2" />}
          <FlagRow flag={flag} onToggle={onToggle} isPending={isPending} locale={locale} />
        </div>
      ))}
    </div>
  )
}

export function WlFeaturesTab() {
  const { t, locale } = useLocale()
  const { flags, isLoading } = useFeatureFlags()
  const { toggleMut } = useFeatureFlagMutation()

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
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-sm text-primary">{t("whiteLabel.featuresHint")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("whiteLabel.moduleFlags")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FlagSection title={t("whiteLabel.flagsModules")} flags={MODULE_FLAGS} allFlags={flags} onToggle={handleToggle} isPending={toggleMut.isPending} locale={locale} />
          <Separator />
          <FlagSection title={t("whiteLabel.flagsBooking")} flags={BOOKING_FLAGS} allFlags={flags} onToggle={handleToggle} isPending={toggleMut.isPending} locale={locale} />
          <Separator />
          <FlagSection title={t("whiteLabel.flagsCompliance")} flags={COMPLIANCE_FLAGS} allFlags={flags} onToggle={handleToggle} isPending={toggleMut.isPending} locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
