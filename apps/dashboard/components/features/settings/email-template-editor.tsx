"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import { useEmailTemplateMutations } from "@/hooks/use-email-templates"
import { useLocale } from "@/components/locale-provider"
import type { EmailTemplate } from "@/lib/types/email-template"

interface Props {
  template: EmailTemplate
  onBack: () => void
}

export function EmailTemplateEditor({ template, onBack }: Props) {
  const { t, locale } = useLocale()
  const { updateMut, previewMut } = useEmailTemplateMutations()

  const [subjectEn, setSubjectEn] = useState(template.subjectEn)
  const [subjectAr, setSubjectAr] = useState(template.subjectAr)
  const [bodyEn, setBodyEn] = useState(template.bodyEn)
  const [bodyAr, setBodyAr] = useState(template.bodyAr)
  const [isActive, setIsActive] = useState(template.isActive)
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)

  const bodyEnRef = useRef<HTMLTextAreaElement>(null)
  const bodyArRef = useRef<HTMLTextAreaElement>(null)
  const lastFocusedLang = useRef<"en" | "ar">("en")

  const variables: string[] = Array.isArray(template.variables)
    ? template.variables
    : []

  const insertVariable = (varName: string, ref: React.RefObject<HTMLTextAreaElement | null>, setter: (v: string) => void, current: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const insert = `{{${varName}}}`
    const newValue = current.substring(0, start) + insert + current.substring(end)
    setter(newValue)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + insert.length, start + insert.length)
    })
  }

  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subjectEn, subjectAr, bodyEn, bodyAr, isActive },
      {
        onSuccess: () => {
          toast.success(t("settings.emailTemplates.saved"))
          onBack()
        },
        onError: () => {
          toast.error(t("settings.error"))
        },
      },
    )
  }

  const handlePreview = () => {
    const sampleContext: Record<string, string> = {}
    for (const v of variables) sampleContext[v] = `[${v}]`
    previewMut.mutate(
      { id: template.id, context: sampleContext, lang: locale as "ar" | "en" },
      {
        onSuccess: (data) => setPreview(data),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        &larr; {t("settings.emailTemplates.backToList")}
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {locale === "ar" ? template.nameAr : template.nameEn}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("settings.emailTemplates.active")}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Variables */}
          {variables.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">
                {t("settings.emailTemplates.variables")}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="cursor-pointer border-primary/30 bg-primary/5 text-xs font-mono hover:bg-primary/10"
                    onClick={() => {
                      const lang = lastFocusedLang.current
                      const ref = lang === "ar" ? bodyArRef : bodyEnRef
                      const setter = lang === "ar" ? setBodyAr : setBodyEn
                      const current = lang === "ar" ? bodyAr : bodyEn
                      insertVariable(v, ref, setter, current)
                    }}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Subject EN */}
          <div>
            <Label className="mb-1.5 block">{t("settings.emailTemplates.subjectEn")}</Label>
            <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} dir="ltr" />
          </div>

          {/* Subject AR */}
          <div>
            <Label className="mb-1.5 block">{t("settings.emailTemplates.subjectAr")}</Label>
            <Input value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} dir="rtl" />
          </div>

          <Separator />

          {/* Body EN */}
          <div>
            <Label className="mb-1.5 block">{t("settings.emailTemplates.bodyEn")}</Label>
            <Textarea
              ref={bodyEnRef}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              onFocus={() => { lastFocusedLang.current = "en" }}
              dir="ltr"
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          {/* Body AR */}
          <div>
            <Label className="mb-1.5 block">{t("settings.emailTemplates.bodyAr")}</Label>
            <Textarea
              ref={bodyArRef}
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
              onFocus={() => { lastFocusedLang.current = "ar" }}
              dir="rtl"
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Separator />

          {/* Preview */}
          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("settings.emailTemplates.previewLabel")}
              </p>
              <p className="text-sm font-medium">{preview.subject}</p>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {preview.body}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewMut.isPending}>
              {t("settings.emailTemplates.preview")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? t("common.saving") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
