"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@carekit/ui"
import { Switch } from "@carekit/ui"
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

  const [subjectEn, setSubjectEn] = useState(template.subjectEn)
  const [subjectAr, setSubjectAr] = useState(template.subjectAr)
  const [bodyEn, setBodyEn] = useState(template.bodyEn)
  const [bodyAr, setBodyAr] = useState(template.bodyAr)
  const [isActive, setIsActive] = useState(template.isActive)

  const bodyEnRef = useRef<HTMLTextAreaElement>(null)
  const bodyArRef = useRef<HTMLTextAreaElement>(null)
  const lastFocusedLang = useRef<"en" | "ar">("en")

  const variables: string[] = Array.isArray(template.variables) ? template.variables : []

  const insertVariable = (
    varName: string,
    ref: React.RefObject<HTMLTextAreaElement | null>,
    setter: (v: string) => void,
    current: string,
  ) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const insert = `{{${varName}}}`
    setter(current.substring(0, start) + insert + current.substring(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + insert.length, start + insert.length)
    })
  }

  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subjectEn, subjectAr, bodyEn, bodyAr, isActive },
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
          {locale === "ar" ? template.nameAr : template.nameEn}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{t("settings.emailTemplates.active")}</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {variables.length > 0 && (
        <Card className="shadow-sm bg-surface">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-2">{t("settings.emailTemplates.variables")}</p>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer border-primary/30 bg-primary/5 text-xs font-mono hover:bg-primary/10"
                  onClick={() => {
                    const lang = lastFocusedLang.current
                    insertVariable(v, lang === "ar" ? bodyArRef : bodyEnRef, lang === "ar" ? setBodyAr : setBodyEn, lang === "ar" ? bodyAr : bodyEn)
                  }}
                >
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-2 gap-3 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.bodyEn")}</Label>
            <Textarea ref={bodyEnRef} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} onFocus={() => { lastFocusedLang.current = "en" }} dir="ltr" rows={5} className="font-mono text-xs resize-none w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.bodyAr")}</Label>
            <Textarea ref={bodyArRef} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} onFocus={() => { lastFocusedLang.current = "ar" }} dir="rtl" rows={5} className="font-mono text-xs resize-none w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
