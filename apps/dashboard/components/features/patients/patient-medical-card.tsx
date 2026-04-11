"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { HeartCheckIcon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"
import { BLOOD_TYPES, BLOOD_LABELS, type CreatePatientFormData, type EditPatientFormData } from "@/lib/schemas/patient.schema"
import { Field } from "@/components/features/patients/patient-form"

interface PatientMedicalCardProps {
  form: UseFormReturn<CreatePatientFormData> | UseFormReturn<EditPatientFormData>
  isCreate: boolean
}

export function PatientMedicalCard({ form, isCreate }: PatientMedicalCardProps) {
  const { control, register } = form as UseFormReturn<EditPatientFormData>
  const { t } = useLocale()

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <SectionHeader
          icon={HeartCheckIcon}
          title={isCreate
            ? t("patients.form.medicalBasics")
            : t("patients.form.medicalInfo")}
          description={isCreate ? t("patients.form.medicalBasicsDesc") : undefined}
        />

        <Field label={t("patients.form.bloodType")}>
          <Controller
            control={control}
            name="bloodType"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("patients.form.bloodType")}>
                {BLOOD_TYPES.filter((b) => b !== "UNKNOWN").map((val) => (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={field.value === val}
                    onClick={() => field.onChange(field.value === val ? undefined : val)}
                    className={cn(
                      "rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors",
                      field.value === val
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {BLOOD_LABELS[val]}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label={t("patients.form.allergies")}>
          <Textarea
            {...register("allergies")}
            placeholder={t("patients.form.allergiesPlaceholder")}
            rows={3}
          />
        </Field>

        <Field label={t("patients.form.chronicConditions")}>
          <Textarea
            {...register("chronicConditions")}
            placeholder={t("patients.form.chronicPlaceholder")}
            rows={3}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
