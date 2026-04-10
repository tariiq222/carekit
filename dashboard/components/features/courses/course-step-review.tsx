"use client"

import { useWatch, type UseFormReturn } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Edit02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import type { CourseFormValues, CourseWizardStep } from "@/lib/schemas/courses.schema"

interface Props {
  form: UseFormReturn<CourseFormValues>
  onGoToStep: (step: CourseWizardStep) => void
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-end">{value ?? "—"}</span>
    </div>
  )
}

function ReviewSection({
  title, step, onGoToStep, children,
}: {
  title: string
  step: CourseWizardStep
  onGoToStep: (s: CourseWizardStep) => void
  children: React.ReactNode
}) {
  const { t } = useLocale()
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-3">
        <span className="text-sm font-semibold">{title}</span>
        <Button
          variant="ghost" size="sm" type="button"
          className="h-7 gap-1 text-xs text-primary"
          onClick={() => onGoToStep(step)}
        >
          <HugeiconsIcon icon={Edit02Icon} size={13} />
          {t("common.edit")}
        </Button>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export function CourseStepReview({ form, onGoToStep }: Props) {
  const { t, locale } = useLocale()
  const values = useWatch({ control: form.control })

  const freqLabel = values.frequency ? t(`courses.frequency.${values.frequency}`) : "—"
  const modeLabel = values.deliveryMode ? t(`courses.deliveryMode.${values.deliveryMode}`) : "—"
  const priceDisplay =
    values.priceHalalat != null && values.priceHalalat > 0
      ? `${values.priceHalalat}`
      : t("courses.free")

  const startDateDisplay = values.startDate
    ? new Date(values.startDate).toLocaleDateString(
        locale === "ar" ? "ar-SA" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : "—"

  return (
    <div className="flex flex-col gap-4">
      <ReviewSection title={t("courses.wizard.step1")} step={1} onGoToStep={onGoToStep}>
        <ReviewRow label={t("courses.nameAr")} value={values.nameAr} />
        <ReviewRow label={t("courses.nameEn")} value={values.nameEn} />
        <ReviewRow label={t("courses.practitioner")} value={values.practitionerId ?? "—"} />
      </ReviewSection>

      <ReviewSection title={t("courses.wizard.step2")} step={2} onGoToStep={onGoToStep}>
        <ReviewRow label={t("courses.totalSessions")} value={values.totalSessions} />
        <ReviewRow
          label={t("courses.durationPerSession")}
          value={values.durationPerSessionMin ? `${values.durationPerSessionMin} ${t("courses.minutes")}` : "—"}
        />
        <ReviewRow label={t("courses.frequency")} value={freqLabel} />
        <ReviewRow label={t("courses.startDate")} value={startDateDisplay} />
      </ReviewSection>

      <ReviewSection title={t("courses.wizard.step3")} step={3} onGoToStep={onGoToStep}>
        <ReviewRow label={t("courses.price")} value={priceDisplay} />
        <ReviewRow
          label={t("courses.isGroup")}
          value={values.isGroup ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}
        />
        {values.isGroup && (
          <ReviewRow label={t("courses.maxParticipants")} value={values.maxParticipants} />
        )}
        <ReviewRow label={t("courses.deliveryMode")} value={modeLabel} />
        {values.location && (
          <ReviewRow label={t("courses.location")} value={values.location} />
        )}
      </ReviewSection>
    </div>
  )
}
