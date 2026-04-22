"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useIntakeForm } from "@/hooks/use-intake-forms"
import type { IntakeForm, FormField, FieldType } from "@/lib/types/intake-form"
import { FORM_TYPE_LABELS } from "@/lib/types/intake-form"
import { FieldPreview } from "./form-field-input"

/* ─── Props ─── */

interface FormPreviewDialogProps {
  form: IntakeForm | null
  open: boolean
  onClose: () => void
}

/* ─── Component ─── */

export function FormPreviewDialog({ form, open, onClose }: FormPreviewDialogProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const { data: formDetail, isLoading: fieldsLoading } = useIntakeForm(form?.id ?? null)
  const [submitted, setSubmitted] = useState(false)

  if (!form) return null

  const fields: FormField[] = (formDetail?.fields ?? []).map((f) => ({
    id: f.id,
    labelEn: f.labelEn,
    labelAr: f.labelAr,
    type: f.fieldType as FieldType,
    required: f.isRequired,
    options: f.options ?? [],
    condition: f.condition ?? undefined,
  }))

  function isVisible(field: FormField): boolean {
    if (!field.condition) return true
    const answer = answers[field.condition.fieldId]
    const val = field.condition.value
    if (field.condition.operator === "equals") return answer === val
    if (field.condition.operator === "not_equals") return answer !== val
    if (field.condition.operator === "contains")
      return typeof answer === "string" && answer.includes(val)
    return true
  }

  function setAnswer(fieldId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  function toggleCheckbox(fieldId: string, option: string) {
    const current = (answers[fieldId] as string[]) ?? []
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option]
    setAnswer(fieldId, next)
  }

  function handleSubmit() {
    setSubmitted(true)
  }

  function handleReset() {
    setAnswers({})
    setSubmitted(false)
  }

  const typeLabel = isAr ? FORM_TYPE_LABELS[form.type].ar : FORM_TYPE_LABELS[form.type].en
  const formName = isAr ? form.nameAr : form.nameEn

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); handleReset() } }}>
      <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {formName}
              </DialogTitle>
              <Badge variant="outline" className="self-start text-xs text-muted-foreground">
                {t("intakeForms.preview.prefix")}{typeLabel}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {submitted ? (
            <SubmittedState t={t} onReset={handleReset} />
          ) : fieldsLoading ? (
            <div className="flex flex-col gap-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-md bg-muted" />
              ))}
            </div>
          ) : fields.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("intakeForms.preview.noFields")}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {fields.filter(isVisible).map((field) => (
                <FieldPreview
                  key={field.id}
                  field={field}
                  isAr={isAr}
                  value={answers[field.id]}
                  onChange={(v) => setAnswer(field.id, v)}
                  onToggleCheckbox={(opt) => toggleCheckbox(field.id, opt)}
                />
              ))}
            </div>
          )}
        </div>

        {!submitted && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { onClose(); handleReset() }}>
              {t("intakeForms.preview.close")}
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {t("intakeForms.preview.submit")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Submitted State ─── */

function SubmittedState({ t, onReset }: { t: (key: string) => string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-success/10">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={28} className="text-success" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          {t("intakeForms.preview.successTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("intakeForms.preview.successNote")}
        </p>
      </div>
      <Separator className="w-24" />
      <Button variant="outline" size="sm" onClick={onReset}>
        {t("intakeForms.preview.tryAgain")}
      </Button>
    </div>
  )
}
