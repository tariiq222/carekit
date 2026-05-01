"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

interface BilingualField {
  ar: string
  en: string
}

function BilingualTextCard({ title, field, fieldKey, onChange, t }: {
  title: string
  field: BilingualField
  fieldKey: string
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
            <Label>{t("common.arabic")}</Label>
            <Textarea
              value={field.ar}
              data-legal-field={`${fieldKey}Ar`}
              onChange={(e) => onChange({ ...field, ar: e.currentTarget.value })}
              onInput={(e) => onChange({ ...field, ar: e.currentTarget.value })}
              onBlur={(e) => onChange({ ...field, ar: e.currentTarget.value })}
              dir="rtl"
              rows={6}
              className="resize-y"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("common.english") ?? "English"}</Label>
            <Textarea
              value={field.en}
              data-legal-field={`${fieldKey}En`}
              onChange={(e) => onChange({ ...field, en: e.currentTarget.value })}
              onInput={(e) => onChange({ ...field, en: e.currentTarget.value })}
              onBlur={(e) => onChange({ ...field, en: e.currentTarget.value })}
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
  const formRef = useRef<HTMLDivElement>(null)
  const pointerSaveRef = useRef(false)

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
    const textareas = Array.from(
      formRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? [],
    )
    const readAt = (index: number, fallback: string) => textareas[index]?.value ?? fallback
    const readField = (field: string, fallback: string) =>
      formRef.current?.querySelector<HTMLTextAreaElement>(`textarea[data-legal-field="${field}"]`)?.value ?? fallback

    updateSettings.mutate(
      {
        aboutAr: readField("aboutAr", readAt(0, about.ar)) || null,
        aboutEn: readField("aboutEn", readAt(1, about.en)) || null,
        privacyPolicyAr: readField("privacyPolicyAr", readAt(2, privacy.ar)) || null,
        privacyPolicyEn: readField("privacyPolicyEn", readAt(3, privacy.en)) || null,
        termsAr: readField("termsAr", readAt(4, terms.ar)) || null,
        termsEn: readField("termsEn", readAt(5, terms.en)) || null,
        cancellationPolicyAr: readField("cancellationPolicyAr", readAt(6, cancellation.ar)) || null,
        cancellationPolicyEn: readField("cancellationPolicyEn", readAt(7, cancellation.en)) || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handlePointerSave = () => {
    pointerSaveRef.current = true
    handleSave()
  }

  const handleClickSave = () => {
    if (pointerSaveRef.current) {
      pointerSaveRef.current = false
      return
    }
    handleSave()
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
    <div ref={formRef} className="space-y-6">
      <BilingualTextCard
        title={t("settings.legal.about")}
        field={about}
        fieldKey="about"
        onChange={setAbout}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.privacy")}
        field={privacy}
        fieldKey="privacyPolicy"
        onChange={setPrivacy}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.terms")}
        field={terms}
        fieldKey="terms"
        onChange={setTerms}
        t={t}
      />
      <BilingualTextCard
        title={t("settings.legal.cancellation")}
        field={cancellation}
        fieldKey="cancellationPolicy"
        onChange={setCancellation}
        t={t}
      />

      <div className="flex justify-end pb-16">
        <Button
          type="button"
          size="sm"
          disabled={updateSettings.isPending}
          onMouseDown={handlePointerSave}
          onClick={handleClickSave}
        >
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
