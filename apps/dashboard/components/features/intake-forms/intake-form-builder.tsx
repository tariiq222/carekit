"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLocale } from "@/components/locale-provider"
import { FieldEditor } from "@/components/features/intake-forms/field-editor"
import { FormInfoTab } from "@/components/features/intake-forms/form-info-tab"
import { useServices } from "@/hooks/use-services"
import { useEmployees } from "@/hooks/use-employees"
import { useBranches } from "@/hooks/use-branches"
import { useFeatureFlagMap } from "@/hooks/use-feature-flags"
import type {
  IntakeForm,
  IntakeFormDraft,
  FormField,
  FormScope,
} from "@/lib/types/intake-form"

function createEmptyField(): FormField {
  return {
    id: crypto.randomUUID(),
    labelEn: "",
    labelAr: "",
    type: "text",
    required: false,
    options: [],
  }
}

function createEmptyDraft(): IntakeFormDraft {
  return {
    nameEn: "",
    nameAr: "",
    type: "pre_booking",
    scope: "global",
    scopeId: "",
    isActive: true,
    fields: [createEmptyField()],
  }
}

interface IntakeFormBuilderProps {
  open: boolean
  editingForm: IntakeForm | null
  onClose: () => void
  onSave: (draft: IntakeFormDraft) => void
}

export function IntakeFormBuilder({
  open,
  editingForm,
  onClose,
  onSave,
}: IntakeFormBuilderProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"

  const { services } = useServices()
  const { employees } = useEmployees()
  const { branches } = useBranches()
  const { isEnabled } = useFeatureFlagMap()
  const isMultiBranch = isEnabled("multi_branch")

  const [draft, setDraft] = useState<IntakeFormDraft>(() =>
    editingForm
      ? {
          nameEn: editingForm.nameEn,
          nameAr: editingForm.nameAr,
          type: editingForm.type,
          scope: editingForm.scope,
          scopeId: editingForm.scopeId ?? "",
          isActive: editingForm.isActive,
          fields: editingForm.fields?.length ? editingForm.fields : [createEmptyField()],
        }
      : createEmptyDraft()
  )

  function update(patch: Partial<IntakeFormDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function handleScopeChange(scope: FormScope) {
    update({ scope, scopeId: "" })
  }

  function addField() {
    update({ fields: [...draft.fields, createEmptyField()] })
  }

  function updateField(index: number, updated: FormField) {
    const fields = [...draft.fields]
    fields[index] = updated
    update({ fields })
  }

  function removeField(index: number) {
    update({ fields: draft.fields.filter((_, i) => i !== index) })
  }

  function moveField(index: number, direction: "up" | "down") {
    const fields = [...draft.fields]
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= fields.length) return
    ;[fields[index], fields[target]] = [fields[target], fields[index]]
    update({ fields })
  }

  function handleSubmit() {
    onSave(draft)
    onClose()
  }

  // Scopes available to the user — hide "branch" when multi_branch is disabled
  const availableScopes: FormScope[] = isMultiBranch
    ? ["global", "service", "employee", "branch"]
    : ["global", "service", "employee"]

  const scopeOptions: { value: string; label: string }[] = (() => {
    if (draft.scope === "service") {
      return services.map((s) => ({
        value: s.id,
        label: isAr ? s.nameAr : s.nameEn,
      }))
    }
    if (draft.scope === "employee") {
      return employees.map((p) => ({
        value: p.id,
        label: isAr && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`,
      }))
    }
    if (draft.scope === "branch" && isMultiBranch) {
      return branches.map((b) => ({
        value: b.id,
        label: isAr ? b.nameAr : b.nameEn,
      }))
    }
    return []
  })()

  const isEditing = !!editingForm
  const title = isEditing
    ? t("intakeForms.page.editTitle")
    : t("intakeForms.page.newTitle")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 shrink-0 self-start">
            <TabsTrigger value="info">
              {t("intakeForms.builder.formInfo")}
            </TabsTrigger>
            <TabsTrigger value="fields">
              {t("intakeForms.builder.fieldsTab")} ({draft.fields.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <TabsContent value="info" className="mt-0">
              <FormInfoTab
                draft={draft}
                scopeOptions={scopeOptions}
                availableScopes={availableScopes}
                onUpdate={update}
                onScopeChange={handleScopeChange}
                isAr={isAr}
              />
            </TabsContent>

            <TabsContent value="fields" className="px-6 pb-6 pt-4 flex flex-col gap-3 mt-0">
              {draft.fields.map((field, i) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={i}
                  totalFields={draft.fields.length}
                  prevFields={draft.fields.slice(0, i)}
                  onChange={(updated) => updateField(i, updated)}
                  onRemove={() => removeField(i)}
                  onMoveUp={() => moveField(i, "up")}
                  onMoveDown={() => moveField(i, "down")}
                />
              ))}

              <Button
                type="button"
                variant="outline"
                className="gap-2 self-start"
                onClick={addField}
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
                {t("intakeForms.page.addField")}
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("intakeForms.page.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing
              ? t("intakeForms.page.saveChanges")
              : t("intakeForms.page.createForm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
