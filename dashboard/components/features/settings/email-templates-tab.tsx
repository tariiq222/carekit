"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useEmailTemplates } from "@/hooks/use-email-templates"
import { useLocale } from "@/components/locale-provider"
import { EmailTemplateEditor } from "./email-template-editor"
import type { EmailTemplate } from "@/lib/types/email-template"

export function EmailTemplatesTab() {
  const { t, locale } = useLocale()
  const { data: templates, isLoading } = useEmailTemplates()
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  if (editing) {
    return <EmailTemplateEditor template={editing} onBack={() => setEditing(null)} />
  }

  const list = templates ?? []
  const selectedTemplate = list.find((tmpl: EmailTemplate) => tmpl.id === activeId) ?? list[0] ?? null

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.emailTemplates.title")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {list.map((tmpl: EmailTemplate) => {
              const isActive = (activeId ?? list[0]?.id) === tmpl.id
              return (
                <div
                  key={tmpl.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => setActiveId(tmpl.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveId(tmpl.id) }}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
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

        {/* ── Content ── */}
        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {selectedTemplate ? (
            <div className="flex flex-col gap-3 h-full">
              <Card className="shadow-sm bg-surface">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-foreground">
                        {locale === "ar" ? selectedTemplate.nameAr : selectedTemplate.nameEn}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {selectedTemplate.slug}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        selectedTemplate.isActive
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground"
                      }
                    >
                      {selectedTemplate.isActive
                        ? t("settings.emailTemplates.active")
                        : t("settings.emailTemplates.inactive")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" onClick={() => setEditing(selectedTemplate)}>
                  {t("common.edit")}
                </Button>
              </div>
            </div>
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
