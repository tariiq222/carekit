"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

interface BilingualField {
  ar: string
  en: string
}

function BilingualTextCard({ title, field, onChange, t }: {
  title: string
  field: BilingualField
  onChange: (field: BilingualField) => void
  t: (key: string) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("common.arabic") ?? "عربي"}</Label>
            <Textarea
              value={field.ar}
              onChange={(e) => onChange({ ...field, ar: e.target.value })}
              dir="rtl"
              rows={6}
              className="resize-y"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("common.english") ?? "English"}</Label>
            <Textarea
              value={field.en}
              onChange={(e) => onChange({ ...field, en: e.target.value })}
              dir="ltr"
              rows={6}
              className="resize-y"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LegalContentTab() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const updateSettings = useUpdateOrganizationSettings()

  const [about, setAbout] = useState<BilingualField>({ ar: "", en: "" })
  const [privacy, setPrivacy] = useState<BilingualField>({ ar: "", en: "" })
  const [terms, setTerms] = useState<BilingualField>({ ar: "", en: "" })
  const [cancellation, setCancellation] = useState<BilingualField>({ ar: "", en: "" })

  useEffect(() => {
    if (!settings) return
    // Seed editable textareas from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbout({ ar: settings.aboutAr ?? "", en: settings.aboutEn ?? "" })
    setPrivacy({ ar: settings.privacyPolicyAr ?? "", en: settings.privacyPolicyEn ?? "" })
    setTerms({ ar: settings.termsAr ?? "", en: settings.termsEn ?? "" })
    setCancellation({ ar: settings.cancellationPolicyAr ?? "", en: settings.cancellationPolicyEn ?? "" })
  }, [settings])

  const handleSave = () => {
    updateSettings.mutate(
      {
        aboutAr: about.ar || null,
        aboutEn: about.en || null,
        privacyPolicyAr: privacy.ar || null,
        privacyPolicyEn: privacy.en || null,
        termsAr: terms.ar || null,
        termsEn: terms.en || null,
        cancellationPolicyAr: cancellation.ar || null,
        cancellationPolicyEn: cancellation.en || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BilingualTextCard
        title={t("settings.legal.about") ?? "عن العيادة"}
        field={about}
        onChange={setAbout}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.privacy") ?? "سياسة الخصوصية"}
        field={privacy}
        onChange={setPrivacy}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.terms") ?? "الشروط والأحكام"}
        field={terms}
        onChange={setTerms}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.cancellation") ?? "سياسة الإلغاء"}
        field={cancellation}
        onChange={setCancellation}
        t={t}
      />

      <div className="flex justify-end">
        <Button size="sm" disabled={updateSettings.isPending} onClick={handleSave}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
