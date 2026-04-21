"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useEmailTemplates, useEmailTemplateMutations } from "@/hooks/use-email-templates"
import { useLocale } from "@/components/locale-provider"
import { EmailLayoutForm } from "./email-layout-form"
import type { EmailTemplate } from "@/lib/types/email-template"

const EMAIL_LAYOUT_ID = "__email-layout__"

/* ─── Inline Editor ─── */

function InlineEditor({ template, t, locale, onSaved, onCancel }: {
  template: EmailTemplate
  t: (k: string) => string
  locale: string
  onSaved: () => void
  onCancel: () => void
}) {
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">
          {locale === "ar" ? template.nameAr : template.nameEn}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{t("settings.emailTemplates.active")}</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Variables */}
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
                    insertVariable(
                      v,
                      lang === "ar" ? bodyArRef : bodyEnRef,
                      lang === "ar" ? setBodyAr : setBodyEn,
                      lang === "ar" ? bodyAr : bodyEn,
                    )
                  }}
                >
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject */}
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

      {/* Body */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.bodyEn")}</Label>
            <Textarea
              ref={bodyEnRef}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              onFocus={() => { lastFocusedLang.current = "en" }}
              dir="ltr"
              rows={5}
              className="font-mono text-xs resize-none w-full"
            />
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label>{t("settings.emailTemplates.bodyAr")}</Label>
            <Textarea
              ref={bodyArRef}
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
              onFocus={() => { lastFocusedLang.current = "ar" }}
              dir="rtl"
              rows={5}
              className="font-mono text-xs resize-none w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Template View (read-only) ─── */

function TemplateView({ template, t, locale, onEdit }: {
  template: EmailTemplate
  t: (k: string) => string
  locale: string
  onEdit: () => void
}) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {locale === "ar" ? template.nameAr : template.nameEn}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              template.isActive
                ? "bg-success/10 text-success border-success/30"
                : "bg-muted text-muted-foreground",
            )}
          >
            {template.isActive ? t("settings.emailTemplates.active") : t("common.inactive")}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t("common.edit")}
        </Button>
      </div>

      {/* Subject */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-1.5 pt-3 pb-3">
            <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.subjectEn")}</p>
            <p className="text-sm text-foreground truncate" dir="ltr">{template.subjectEn || "—"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0">
          <CardContent className="space-y-1.5 pt-3 pb-3">
            <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.subjectAr")}</p>
            <p className="text-sm text-foreground truncate" dir="rtl">{template.subjectAr || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Body */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0 overflow-hidden">
          <CardContent className="space-y-1.5 pt-3 pb-3">
            <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.bodyEn")}</p>
            <pre className="whitespace-pre-wrap break-words text-xs text-foreground leading-relaxed font-mono overflow-hidden" dir="ltr">
              {template.bodyEn || "—"}
            </pre>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0 overflow-hidden">
          <CardContent className="space-y-1.5 pt-3 pb-3">
            <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.bodyAr")}</p>
            <pre className="whitespace-pre-wrap break-words text-xs text-foreground leading-relaxed font-mono overflow-hidden" dir="rtl">
              {template.bodyAr || "—"}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ─── Main Tab ─── */

export function EmailTemplatesTab() {
  const { t, locale } = useLocale()
  const { data: templates, isLoading } = useEmailTemplates()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const list = templates ?? []
  const isLayoutSelected = activeId === EMAIL_LAYOUT_ID
  const selectedTemplate = isLayoutSelected
    ? null
    : (list.find((tmpl: EmailTemplate) => tmpl.id === activeId) ?? list[0] ?? null)
  const isEditing = selectedTemplate?.id === editingId

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.emailTemplates.title")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {/* Email Layout entry */}
            <div
              role="tab"
              aria-selected={isLayoutSelected}
              tabIndex={0}
              onClick={() => { setActiveId(EMAIL_LAYOUT_ID); setEditingId(null) }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveId(EMAIL_LAYOUT_ID); setEditingId(null) } }}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                isLayoutSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <p className="text-sm font-medium truncate leading-tight">
                {t("settings.emailLayout.title")}
              </p>
            </div>
            <div className="border-b border-border mx-1 my-1" />
            {/* Template list */}
            {list.map((tmpl: EmailTemplate) => {
              const isActive = !isLayoutSelected && (activeId ?? list[0]?.id) === tmpl.id
              return (
                <div
                  key={tmpl.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => { setActiveId(tmpl.id); setEditingId(null) }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveId(tmpl.id); setEditingId(null) } }}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <p className="text-sm font-medium truncate leading-tight">
                    {locale === "ar" ? tmpl.nameAr : tmpl.nameEn}
                  </p>
                  {isActive && (
                    <p className="text-xs mt-0.5 line-clamp-1 leading-tight opacity-80 font-mono">
                      {tmpl.slug}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 min-w-0 p-5 overflow-y-auto overflow-x-hidden bg-surface-muted/50 flex flex-col">
          {isLayoutSelected ? (
            <EmailLayoutForm onCancel={() => setActiveId(null)} />
          ) : selectedTemplate ? (
            isEditing ? (
              <InlineEditor
                key={`edit-${selectedTemplate.id}`}
                template={selectedTemplate}
                t={t}
                locale={locale}
                onSaved={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TemplateView
                key={`view-${selectedTemplate.id}`}
                template={selectedTemplate}
                t={t}
                locale={locale}
                onEdit={() => setEditingId(selectedTemplate.id)}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("settings.emailTemplates.description")}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
