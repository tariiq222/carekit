"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { IntakeForm, FormType } from "@/lib/types/intake-form"
import { FORM_TYPE_LABELS, FORM_SCOPE_LABELS } from "@/lib/types/intake-form"

const TYPE_BADGE_STYLES: Record<FormType, string> = {
  pre_booking: "bg-info/10 text-info border-info/20",
  pre_session: "bg-warning/10 text-warning border-warning/20",
  post_session: "bg-success/10 text-success border-success/20",
  registration: "bg-primary/10 text-primary border-primary/20",
}

interface ColumnCallbacks {
  isAr: boolean
  t: (key: string) => string
  onEdit: (form: IntakeForm) => void
  onDelete: (form: IntakeForm) => void
  onPreview: (form: IntakeForm) => void
  onToggleActive: (form: IntakeForm, value: boolean) => void
}

export function getIntakeFormsColumns({
  isAr,
  t,
  onEdit,
  onDelete,
  onPreview,
  onToggleActive,
}: ColumnCallbacks): ColumnDef<IntakeForm>[] {
  return [
    {
      id: "name",
      header: t("intakeForms.col.name"),
      enableSorting: false,
      cell: ({ row }) => {
        const form = row.original
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {isAr ? form.nameAr : form.nameEn}
            </span>
            <span className="text-xs text-muted-foreground">
              {isAr ? form.nameEn : form.nameAr}
            </span>
          </div>
        )
      },
    },
    {
      id: "type",
      header: t("intakeForms.col.type"),
      cell: ({ row }) => {
        const type = row.original.type
        const label = isAr ? FORM_TYPE_LABELS[type].ar : FORM_TYPE_LABELS[type].en
        return (
          <Badge
            variant="outline"
            className={cn("font-medium", TYPE_BADGE_STYLES[type])}
          >
            {label}
          </Badge>
        )
      },
    },
    {
      id: "scope",
      header: t("intakeForms.col.scope"),
      cell: ({ row }) => {
        const { scope, scopeLabel } = row.original
        const scopeName = isAr ? FORM_SCOPE_LABELS[scope].ar : FORM_SCOPE_LABELS[scope].en
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">{scopeName}</span>
            {scopeLabel && (
              <span className="text-xs text-muted-foreground">{scopeLabel}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "fieldsCount",
      header: t("intakeForms.col.fields"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-foreground">
          {row.original.fieldsCount}
        </span>
      ),
    },
    {
      id: "submissionsCount",
      header: t("intakeForms.col.submissions"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium text-foreground">
          {row.original.submissionsCount.toLocaleString()}
        </span>
      ),
    },
    {
      id: "isActive",
      header: t("intakeForms.col.status"),
      cell: ({ row }) => {
        const form = row.original
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => onToggleActive(form, v)}
              aria-label={t("intakeForms.col.toggleStatus")}
            />
            <span className={cn("text-xs font-medium", form.isActive ? "text-success" : "text-muted-foreground")}>
              {form.isActive
                ? t("intakeForms.col.active")
                : t("intakeForms.col.inactive")}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const form = row.original
        const btnBase = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"
        return (
          <div className="flex items-center gap-1 justify-end">
            <button
              className={btnBase}
              onClick={() => onPreview(form)}
              aria-label={t("intakeForms.col.preview")}
            >
              <HugeiconsIcon icon={EyeIcon} size={16} />
            </button>
            <button
              className={btnBase}
              onClick={() => onEdit(form)}
              aria-label={t("intakeForms.col.edit")}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            </button>
            <button
              className={`${btnBase} hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20`}
              onClick={() => onDelete(form)}
              aria-label={t("intakeForms.col.delete")}
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </button>
          </div>
        )
      },
    },
  ]
}
