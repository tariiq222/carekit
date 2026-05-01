"use client"

import { useState } from "react"
import { Button, Label, Textarea } from "@deqah/ui"
import {
  PRIVACY_POLICY_DEFAULTS,
  PRIVACY_POLICY_KEY_AR,
  PRIVACY_POLICY_KEY_DATE,
  PRIVACY_POLICY_KEY_EN,
  type PrivacyPolicyFormValues,
  type SiteSettingRow,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"
import { formatLocaleDate } from "@/lib/date"
import { toast } from "sonner"

function buildInitial(rows: SiteSettingRow[]): PrivacyPolicyFormValues {
  const map = new Map(rows.map((r) => [r.key, r]))
  return {
    ar: map.get(PRIVACY_POLICY_KEY_AR)?.valueAr ?? PRIVACY_POLICY_DEFAULTS.ar,
    en: map.get(PRIVACY_POLICY_KEY_EN)?.valueEn ?? PRIVACY_POLICY_DEFAULTS.en,
  }
}

function formatDate(iso: string, locale: string): string {
  return formatLocaleDate(iso, locale, { year: "numeric", month: "short", day: "numeric" })
}

interface Props {
  rows: SiteSettingRow[]
}

// Page shows a skeleton while loading so rows is already populated when this mounts.
export function PrivacyPolicyForm({ rows }: Props) {
  const { t, locale } = useLocale()
  const mutation = useUpsertSiteSettings()
  const [values, setValues] = useState<PrivacyPolicyFormValues>(() => buildInitial(rows))
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    () => rows.find((r) => r.key === PRIVACY_POLICY_KEY_DATE)?.valueText ?? null,
  )

  const handleSave = () => {
    const now = new Date().toISOString()
    mutation.mutate(
      {
        entries: [
          { key: PRIVACY_POLICY_KEY_AR, valueAr: values.ar },
          { key: PRIVACY_POLICY_KEY_EN, valueEn: values.en },
          { key: PRIVACY_POLICY_KEY_DATE, valueText: now },
        ],
      },
      {
        onSuccess: () => {
          setLastUpdated(now)
          toast.success(t("content.form.save"))
        },
        onError: () => {
          toast.error(locale === "ar" ? "فشل حفظ المحتوى" : "Failed to save content")
        },
      },
    )
  }

  const handleReset = () => {
    setValues({ ...PRIVACY_POLICY_DEFAULTS })
  }

  const lastUpdatedDisplay = lastUpdated
    ? formatDate(lastUpdated, locale)
    : t("content.legal.privacy.never")

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label htmlFor="privacy-ar">{t("content.legal.privacy.arLabel")}</Label>
        <Textarea
          id="privacy-ar"
          dir="rtl"
          rows={18}
          className="text-sm font-mono leading-relaxed resize-y"
          style={{ textAlign: "right" }}
          value={values.ar}
          onChange={(e) => setValues((v) => ({ ...v, ar: e.target.value }))}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="privacy-en">{t("content.legal.privacy.enLabel")}</Label>
        <Textarea
          id="privacy-en"
          dir="ltr"
          rows={18}
          className="text-sm font-mono leading-relaxed resize-y"
          style={{ textAlign: "left" }}
          value={values.en}
          onChange={(e) => setValues((v) => ({ ...v, en: e.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("content.legal.privacy.lastUpdated")}: <span className="font-medium text-foreground">{lastUpdatedDisplay}</span>
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} disabled={mutation.isPending}>
            {t("content.legal.privacy.resetToDefault")}
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? t("content.form.saving") : t("content.form.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
