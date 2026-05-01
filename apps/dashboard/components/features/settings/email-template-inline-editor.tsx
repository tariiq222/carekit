"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { useEmailTemplateMutations } from "@/hooks/use-email-templates"
import type { EmailTemplate } from "@/lib/types/email-template"

interface Props {
  template: EmailTemplate
  t: (k: string) => string
  locale: string
  onSaved: () => void
  onCancel: () => void
}

export function EmailTemplateInlineEditor({ template, t, locale, onSaved, onCancel }: Props) {
  const { updateMut } = useEmailTemplateMutations()

  const [subjectEn, setSubjectEn] = useState(template.subjectEn ?? "")
  const [subjectAr, setSubjectAr] = useState(template.subjectAr)
  const [htmlBody, setHtmlBody] = useState(template.htmlBody)
  const [isActive, setIsActive] = useState(template.isActive)

  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subjectEn, subjectAr, htmlBody, isActive },
      {
        onSuccess: () => { toast.success(t("settings.emailTemplates.saved")); onSaved() },
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto overflow-x-hidden min-w-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">
          {locale === "ar" ? template.nameAr : (template.nameEn ?? template.nameAr)}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{t("settings.emailTemplates.active")}</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.subjectEn")}</Label>
            <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} dir="ltr" className="w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.subjectAr")}</Label>
            <Input value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} dir="rtl" className="w-full" />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm bg-surface min-w-0">
        <CardContent className="space-y-2 pt-3 pb-3">
          <Label>{t("settings.emailTemplates.htmlBody")}</Label>
          <Textarea value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} dir="ltr" rows={10} className="font-mono text-xs resize-y w-full" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-auto pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
