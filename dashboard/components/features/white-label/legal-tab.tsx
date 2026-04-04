"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

function BilingualTextCard({ titleKey, arValue, enValue, onArChange, onEnChange, onSave, isPending, t }: {
  titleKey: string
  arValue: string
  enValue: string
  onArChange: (v: string) => void
  onEnChange: (v: string) => void
  onSave: () => void
  isPending: boolean
  t: (k: string) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("whiteLabel.textAr")}</Label>
          <Textarea value={arValue} onChange={(e) => onArChange(e.target.value)} rows={5} dir="rtl" />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>{t("whiteLabel.textEn")}</Label>
          <Textarea value={enValue} onChange={(e) => onEnChange(e.target.value)} rows={5} dir="ltr" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={onSave}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function LegalTab({ configMap, onSave, isPending, t }: Props) {
  const [aboutAr, setAboutAr] = useState("")
  const [aboutEn, setAboutEn] = useState("")
  const [privacyAr, setPrivacyAr] = useState("")
  const [privacyEn, setPrivacyEn] = useState("")
  const [termsAr, setTermsAr] = useState("")
  const [termsEn, setTermsEn] = useState("")

  useEffect(() => {
    setAboutAr(configMap.about_ar ?? "")
    setAboutEn(configMap.about_en ?? "")
    setPrivacyAr(configMap.privacy_policy_ar ?? "")
    setPrivacyEn(configMap.privacy_policy_en ?? "")
    setTermsAr(configMap.terms_ar ?? "")
    setTermsEn(configMap.terms_en ?? "")
  }, [configMap])

  return (
    <div className="space-y-6">
      <BilingualTextCard
        titleKey="whiteLabel.about"
        arValue={aboutAr} enValue={aboutEn}
        onArChange={setAboutAr} onEnChange={setAboutEn}
        onSave={() => onSave([
          { key: "about_ar", value: aboutAr },
          { key: "about_en", value: aboutEn },
        ])}
        isPending={isPending} t={t}
      />
      <BilingualTextCard
        titleKey="whiteLabel.privacy"
        arValue={privacyAr} enValue={privacyEn}
        onArChange={setPrivacyAr} onEnChange={setPrivacyEn}
        onSave={() => onSave([
          { key: "privacy_policy_ar", value: privacyAr },
          { key: "privacy_policy_en", value: privacyEn },
        ])}
        isPending={isPending} t={t}
      />
      <BilingualTextCard
        titleKey="whiteLabel.terms"
        arValue={termsAr} enValue={termsEn}
        onArChange={setTermsAr} onEnChange={setTermsEn}
        onSave={() => onSave([
          { key: "terms_ar", value: termsAr },
          { key: "terms_en", value: termsEn },
        ])}
        isPending={isPending} t={t}
      />
    </div>
  )
}
