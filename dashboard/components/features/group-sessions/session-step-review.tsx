"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import type { CreateGroupSessionFormValues, SessionWizardStep } from "@/lib/schemas/group-sessions.schema"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
  onGoToStep: (step: SessionWizardStep) => void
}

interface SectionProps {
  title: string
  onEdit: () => void
  children: React.ReactNode
}

function ReviewSection({ title, onEdit, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4">
      <div className="flex items-center justify-between py-3 border-b border-border/60">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={onEdit}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
        </Button>
      </div>
      <div className="flex flex-col gap-2 py-3">{children}</div>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
}

function ReviewRow({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-end">{value}</span>
    </div>
  )
}

export function SessionStepReview({ form, onGoToStep }: Props) {
  const { t } = useLocale()
  const values = form.getValues()

  const notSet = t("groupSessions.wizard.notSet")
  const boolLabel = (v: boolean | undefined) => v ? "✓" : "—"
  const orNA = (v: string | null | undefined) => v || notSet

  return (
    <div className="flex flex-col gap-4">
      <ReviewSection title={t("groupSessions.wizard.review.basicInfo")} onEdit={() => onGoToStep(1)}>
        <ReviewRow label={t("groupSessions.nameAr")} value={values.nameAr || notSet} />
        <ReviewRow label={t("groupSessions.nameEn")} value={values.nameEn || notSet} />
        <ReviewRow label={t("groupSessions.descriptionAr")} value={orNA(values.descriptionAr)} />
        <ReviewRow label={t("groupSessions.descriptionEn")} value={orNA(values.descriptionEn)} />
        <ReviewRow label={t("groupSessions.practitioner")} value={values.practitionerId || notSet} />
      </ReviewSection>

      <ReviewSection title={t("groupSessions.wizard.review.settings")} onEdit={() => onGoToStep(2)}>
        <ReviewRow label={t("groupSessions.minParticipants")} value={String(values.minParticipants)} />
        <ReviewRow label={t("groupSessions.maxParticipants")} value={String(values.maxParticipants)} />
        <ReviewRow label={t("groupSessions.pricePerPerson")} value={String(values.pricePerPersonHalalat)} />
        <ReviewRow label={t("groupSessions.duration")} value={String(values.durationMinutes)} />
        <ReviewRow label={t("groupSessions.paymentDeadline")} value={values.paymentDeadlineHours ? String(values.paymentDeadlineHours) : notSet} />
      </ReviewSection>

      <ReviewSection title={t("groupSessions.wizard.review.scheduling")} onEdit={() => onGoToStep(3)}>
        <ReviewRow label={t("groupSessions.scheduling")} value={values.schedulingMode === "fixed_date" ? t("groupSessions.fixedDate") : t("groupSessions.onCapacity")} />
        {values.schedulingMode === "fixed_date" && (
          <ReviewRow label={t("groupSessions.startTime")} value={values.startTime ? new Date(values.startTime).toLocaleString() : notSet} />
        )}
        <ReviewRow label={t("groupSessions.publishForClients")} value={boolLabel(values.isPublished)} />
        <ReviewRow label={t("groupSessions.expiresAt")} value={values.expiresAt ? new Date(values.expiresAt).toLocaleString() : notSet} />
      </ReviewSection>
    </div>
  )
}
