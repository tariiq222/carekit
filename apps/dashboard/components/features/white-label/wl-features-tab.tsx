"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useLicenseFeatures, useUpdateLicense } from "@/hooks/use-license"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import type { FeatureWithStatus } from "@/lib/types/license"
import type { UpdateLicensePayload } from "@/lib/types/license"

const MODULE_FLAGS = ["coupons", "gift_cards", "intake_forms", "chatbot", "ratings", "multi_branch", "reports"]
const BOOKING_FLAGS = ["recurring", "walk_in", "waitlist", "zoom"]
const COMPLIANCE_FLAGS = ["zatca"]

const LICENSE_KEY_MAP: Record<string, keyof UpdateLicensePayload> = {
  coupons: "hasCoupons",
  gift_cards: "hasGiftCards",
  intake_forms: "hasIntakeForms",
  chatbot: "hasChatbot",
  ratings: "hasRatings",
  multi_branch: "hasMultiBranch",
  reports: "hasReports",
  recurring: "hasRecurring",
  walk_in: "hasWalkIn",
  waitlist: "hasWaitlist",
  zoom: "hasZoom",
  zatca: "hasZatca",
}

function FeatureRow({ feature, onToggle, isPending, locale }: {
  feature: FeatureWithStatus
  onToggle: (key: string, licensed: boolean) => void
  isPending: boolean
  locale: string
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 pe-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            {locale === "ar" ? feature.nameAr : feature.nameEn}
          </p>
          <Badge
            variant={feature.licensed ? "default" : "secondary"}
            className="text-[10px] px-1.5 py-0"
          >
            {feature.licensed ? "مفعّل" : "معطّل"}
          </Badge>
        </div>
      </div>
      <Switch
        checked={feature.licensed}
        onCheckedChange={(checked) => onToggle(feature.key, checked)}
        disabled={isPending}
      />
    </div>
  )
}

function FeatureSection({ title, keys, features, onToggle, isPending, locale }: {
  title: string
  keys: string[]
  features: FeatureWithStatus[]
  onToggle: (key: string, licensed: boolean) => void
  isPending: boolean
  locale: string
}) {
  const sectionFeatures = features.filter((f) => keys.includes(f.key))
  if (sectionFeatures.length === 0) return null
  return (
    <div className="space-y-1">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {sectionFeatures.map((feature, i) => (
        <div key={feature.key}>
          {i > 0 && <Separator className="my-2" />}
          <FeatureRow feature={feature} onToggle={onToggle} isPending={isPending} locale={locale} />
        </div>
      ))}
    </div>
  )
}

export function WlFeaturesTab() {
  const { t, locale } = useLocale()
  const { data: features, isLoading } = useLicenseFeatures()
  const updateLicense = useUpdateLicense()

  const handleToggle = (key: string, licensed: boolean) => {
    const licenseKey = LICENSE_KEY_MAP[key]
    if (!licenseKey) return
    updateLicense.mutate(
      { [licenseKey]: licensed },
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

  const featureList = features ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <p className="text-sm text-warning-foreground">
          {t("whiteLabel.licenseHint") ?? "تحكم في الميزات المتاحة لهذه العيادة. تعطيل الرخصة يمنع العيادة من استخدام الميزة."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("whiteLabel.licenseManagement") ?? "إدارة الرخصة"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureSection title={t("whiteLabel.flagsModules")} keys={MODULE_FLAGS} features={featureList} onToggle={handleToggle} isPending={updateLicense.isPending} locale={locale} />
          <Separator />
          <FeatureSection title={t("whiteLabel.flagsBooking")} keys={BOOKING_FLAGS} features={featureList} onToggle={handleToggle} isPending={updateLicense.isPending} locale={locale} />
          <Separator />
          <FeatureSection title={t("whiteLabel.flagsCompliance")} keys={COMPLIANCE_FLAGS} features={featureList} onToggle={handleToggle} isPending={updateLicense.isPending} locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
