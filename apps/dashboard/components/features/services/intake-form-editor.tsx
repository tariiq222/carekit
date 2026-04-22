"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon, ArrowDown01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { useIntakeForms, useIntakeFormMutations } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { IntakeFieldsEditor } from "./intake-fields-editor"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"

interface Props {
  serviceId: string
  locale: string
}

export function IntakeFormEditor({ serviceId, locale }: Props) {
  const { t } = useLocale()
  const isAr = locale === "ar"
  const [open, setOpen] = useState(false)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: forms, isLoading } = useIntakeForms(serviceId)
  const { createMut, updateMut, deleteMut } = useIntakeFormMutations(serviceId)

  const handleCreate = async (nameAr: string, nameEn: string) => {
    try {
      await createMut.mutateAsync({ nameAr, nameEn })
      setShowCreate(false)
      toast.success(t("services.intake.formCreated"))
    } catch {
      toast.error(t("services.intake.formCreateFailed"))
    }
  }

  const handleToggleActive = async (form: IntakeFormApi) => {
    try {
      await updateMut.mutateAsync({
        formId: form.id,
        payload: { isActive: !form.isActive },
      })
    } catch {
      toast.error(t("services.intake.updateFailed"))
    }
  }

  const handleDelete = async (formId: string) => {
    try {
      await deleteMut.mutateAsync(formId)
      toast.success(t("services.intake.formDeleted"))
    } catch {
      toast.error(t("services.intake.formDeleteFailed"))
    }
  }

  return (
    <div className="space-y-3">
      <Separator />
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between p-0 text-sm font-medium text-foreground hover:bg-transparent"
        onClick={() => setOpen(!open)}
      >
        {t("services.intake.title")}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              {t("services.intake.loading")}
            </p>
          )}

          {forms?.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              isAr={isAr}
              t={t}
              isEditing={editingFormId === form.id}
              serviceId={serviceId}
              locale={locale}
              onToggleEdit={() =>
                setEditingFormId(editingFormId === form.id ? null : form.id)
              }
              onToggleActive={() => handleToggleActive(form)}
              onDelete={() => handleDelete(form.id)}
            />
          ))}

          {forms?.length === 0 && !isLoading && (
            <p className="text-center text-sm text-muted-foreground">
              {t("services.intake.empty")}
            </p>
          )}

          {showCreate ? (
            <CreateFormInline
              isAr={isAr}
              t={t}
              isPending={createMut.isPending}
              onSave={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 me-1" />
              {t("services.intake.addForm")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Form Card ─── */

function FormCard({
  form,
  isAr,
  t,
  isEditing,
  serviceId,
  locale,
  onToggleEdit,
  onToggleActive,
  onDelete,
}: {
  form: IntakeFormApi
  isAr: boolean
  t: (key: string) => string
  isEditing: boolean
  serviceId: string
  locale: string
  onToggleEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isAr ? form.nameAr : (form.nameEn ?? form.nameAr)}
          </span>
          {!form.isActive && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("services.intake.inactive")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Switch checked={form.isActive} onCheckedChange={onToggleActive} />
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onToggleEdit} aria-label={t("services.intake.editForm")}>
            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={t("services.intake.deleteForm")}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {form.fields.length} {t("services.intake.fields")}
      </p>

      {isEditing && (
        <IntakeFieldsEditor
          formId={form.id}
          serviceId={serviceId}
          initialFields={form.fields}
          locale={locale}
        />
      )}
    </div>
  )
}

/* ─── Create Form Inline ─── */

function CreateFormInline({
  isAr: _isAr,
  t,
  isPending,
  onSave,
  onCancel,
}: {
  isAr: boolean
  t: (key: string) => string
  isPending: boolean
  onSave: (nameAr: string, nameEn: string) => void
  onCancel: () => void
}) {
  const [nameEn, setNameEn] = useState("")
  const [nameAr, setNameAr] = useState("")

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("services.intake.titleEn")}</Label>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("services.intake.titleAr")}</Label>
          <Input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className="h-8 text-sm"
            dir="rtl"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !nameEn.trim() || !nameAr.trim()}
          onClick={() => onSave(nameAr.trim(), nameEn.trim())}
        >
          {isPending ? t("services.intake.creating") : t("services.intake.create")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("services.intake.cancel")}
        </Button>
      </div>
    </div>
  )
}
