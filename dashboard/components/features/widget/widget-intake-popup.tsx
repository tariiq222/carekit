"use client"

/**
 * Widget Intake Popup — post-booking modal for filling intake form
 * Only shown when intakeFormRequired && !intakeFormAlreadySubmitted
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, CheckmarkCircle01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fetchIntakeForm } from "@/lib/api/intake-forms"
import { api } from "@/lib/api"
import type { IntakeFieldApi } from "@/lib/types/intake-form-api"
import type { FieldType } from "@/lib/types/intake-form-shared"

/* ─── Types ─── */

interface SubmitPayload {
  bookingId: string
  answers: Record<string, string>
}

interface Props {
  locale: "ar" | "en"
  formId: string
  bookingId: string
  onDismiss: () => void
}

/* ─── Field renderer ─── */

function FieldInput({
  field,
  locale,
  value,
  onChange,
}: {
  field: IntakeFieldApi
  locale: "ar" | "en"
  value: string
  onChange: (v: string) => void
}) {
  const label = locale === "ar" ? field.labelAr : field.labelEn
  const type = field.fieldType as FieldType

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">
        {label}
        {field.isRequired && <span className="text-destructive ms-0.5">*</span>}
      </Label>

      {type === "textarea" && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="resize-none text-sm"
        />
      )}

      {(type === "select" || type === "radio") && field.options && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {type !== "textarea" && type !== "select" && type !== "radio" && (
        <Input
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}
    </div>
  )
}

/* ─── Main component ─── */

export function WidgetIntakePopup({ locale, formId, bookingId, onDismiss }: Props) {
  const isRtl = locale === "ar"
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  /* ─── Fetch form ─── */
  const { data: form, isLoading } = useQuery({
    queryKey: ["intake-form", formId],
    queryFn: () => fetchIntakeForm(formId),
    staleTime: 5 * 60 * 1000,
  })

  /* ─── Submit mutation ─── */
  const { mutate: submitForm, isPending } = useMutation({
    mutationFn: (payload: SubmitPayload) =>
      api.post<unknown>(`/intake-forms/${formId}/responses`, payload),
    onSuccess: () => {
      setSubmitted(true)
      setTimeout(onDismiss, 1500)
    },
  })

  /* ─── Handlers ─── */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitForm({ bookingId, answers })
  }

  function handleDismiss() {
    setDismissing(true)
    setTimeout(onDismiss, 2000)
  }

  /* ─── Sorted fields ─── */
  const fields = form?.fields
    ? [...form.fields].sort((a, b) => a.sortOrder - b.sortOrder)
    : []

  /* ─── Labels ─── */
  const t = {
    title: isRtl ? "استبيان ما قبل الجلسة" : "Pre-Session Form",
    subtitle: isRtl
      ? "يرجى تعبئة هذا النموذج قبل موعدك"
      : "Please fill this form before your appointment",
    submit: isRtl ? "إرسال" : "Submit",
    skip: isRtl ? "تخطي" : "Skip",
    skipWarning: isRtl
      ? "سيتم إغلاق النموذج. يمكنك ملؤه لاحقاً."
      : "Form will close. You can fill it later.",
    successMsg: isRtl ? "تم الإرسال بنجاح!" : "Submitted successfully!",
    loading: isRtl ? "جاري التحميل..." : "Loading...",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="glass-solid w-full max-w-md rounded-2xl shadow-2xl border border-border/50 overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border/30">
          <div>
            <p className="font-semibold text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
            aria-label={isRtl ? "إغلاق" : "Close"}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Success state */}
          {submitted && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={48} className="text-success" />
              <p className="font-medium text-foreground">{t.successMsg}</p>
            </div>
          )}

          {/* Dismiss warning */}
          {!submitted && dismissing && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t.skipWarning}</p>
            </div>
          )}

          {/* Loading */}
          {!submitted && !dismissing && isLoading && (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading03Icon} size={28} className="text-primary animate-spin" />
            </div>
          )}

          {/* Form */}
          {!submitted && !dismissing && !isLoading && form && (
            <form id="intake-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
              {fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  locale={locale}
                  value={answers[field.id] ?? ""}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
                />
              ))}
            </form>
          )}
        </div>

        {/* Footer */}
        {!submitted && !dismissing && !isLoading && form && (
          <div className="flex gap-3 p-5 border-t border-border/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="flex-1"
            >
              {t.skip}
            </Button>
            <Button
              type="submit"
              form="intake-form"
              size="sm"
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? (
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
              ) : (
                t.submit
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
