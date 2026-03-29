"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailTemplates } from "@/hooks/use-email-templates"
import { useLocale } from "@/components/locale-provider"
import { EmailTemplateEditor } from "./email-template-editor"
import type { EmailTemplate } from "@/lib/types/email-template"

export function EmailTemplatesTab() {
  const { t, locale } = useLocale()
  const { data: templates, isLoading } = useEmailTemplates()
  const [editing, setEditing] = useState<EmailTemplate | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  if (editing) {
    return (
      <EmailTemplateEditor
        template={editing}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.emailTemplates.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("settings.emailTemplates.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {(templates ?? []).map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => setEditing(tmpl)}
            className="flex w-full items-center justify-between rounded-lg border border-border p-4 text-start transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {locale === "ar" ? tmpl.nameAr : tmpl.nameEn}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {tmpl.slug}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  tmpl.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
                }
              >
                {tmpl.isActive
                  ? t("settings.emailTemplates.active")
                  : t("settings.emailTemplates.inactive")}
              </Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
