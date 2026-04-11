"use client"

import { useId, isValidElement, cloneElement } from "react"
import { UseFormReturn, Controller, FieldErrors } from "react-hook-form"
import {
  UserIcon,
  SmartPhone01Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { NationalitySelect } from "@/components/ui/nationality-select"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"
import {
  type CreatePatientFormData,
  type EditPatientFormData,
} from "@/lib/schemas/patient.schema"
import { PatientMedicalCard } from "@/components/features/patients/patient-medical-card"

/* ─── Internal helper types ─── */

/** Union of both form schemas — allows PatientFormFields to accept create or edit forms. */
type PatientFormData = CreatePatientFormData | EditPatientFormData

/* ─── Field ─── */

export function Field({ label, error, children, required, htmlFor: htmlForProp }: {
  label: string
  error?: string
  children: React.ReactNode
  required?: boolean
  htmlFor?: string
}) {
  const generatedId = useId()
  const id = htmlForProp ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}{required && " *"}</Label>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/* ─── PatientFormFields ─── */

interface PatientFormFieldsProps {
  form: UseFormReturn<CreatePatientFormData> | UseFormReturn<EditPatientFormData>
  errors: FieldErrors<PatientFormData>
  mode: "create" | "edit"
}

export function PatientFormFields({ form, errors, mode }: PatientFormFieldsProps) {
  const { control, register } = form as UseFormReturn<EditPatientFormData>
  const { t, locale } = useLocale()
  const isCreate = mode === "create"

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* ── Card 1: Personal ── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <SectionHeader
            icon={UserIcon}
            title={t("patients.form.personalInfo")}
            description={t("patients.form.personalInfoDesc")}
          />

          <div className="grid grid-cols-3 gap-3">
            <Field
              label={t("patients.form.firstName")}
              error={errors.firstName?.message}
              required={isCreate}
            >
              <Input {...register("firstName")} />
            </Field>
            <Field label={t("patients.form.middleName")}>
              <Input {...register("middleName")} />
            </Field>
            <Field
              label={t("patients.form.lastName")}
              error={errors.lastName?.message}
              required={isCreate}
            >
              <Input {...register("lastName")} />
            </Field>
          </div>

          <Field label={t("patients.form.gender")}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("patients.form.gender")}>
                  {(["male", "female"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={field.value === val}
                      onClick={() => field.onChange(field.value === val ? undefined : val)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                        field.value === val
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {val === "male" ? t("patients.form.male") : t("patients.form.female")}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("patients.form.dateOfBirth")}>
              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    maxDate={new Date().toISOString().split("T")[0]}
                    error={!!errors.dateOfBirth}
                  />
                )}
              />
            </Field>
            <Field label={t("patients.form.nationality")}>
              <Controller
                control={control}
                name="nationality"
                defaultValue="السعودية"
                render={({ field }) => (
                  <NationalitySelect
                    value={field.value ?? (locale === "ar" ? "السعودية" : "Saudi Arabia")}
                    onChange={field.onChange}
                    locale={locale}
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("patients.form.nationalId")}>
            <Input
              {...register("nationalId")}
              placeholder="1XXXXXXXXX"
              dir="ltr"
              className="tabular-nums"
            />
          </Field>

          {!isCreate && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex h-9 items-center justify-between rounded-lg border border-border px-3">
                  <Label htmlFor="patient-active" className="cursor-pointer text-sm">
                    {t("patients.form.accountActive")}
                  </Label>
                  <Switch
                    id="patient-active"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Card 2: Contact + Emergency ── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <SectionHeader
            icon={SmartPhone01Icon}
            title={t("patients.form.contactInfo")}
            description={isCreate ? t("patients.form.phoneDesc") : undefined}
          />

          <Field
            label={t("patients.form.phone")}
            error={errors.phone?.message}
            required={isCreate}
          >
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          {isCreate && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5">
              {t("patients.form.phoneHint")}
            </p>
          )}

          <SectionHeader
            icon={Alert02Icon}
            title={t("patients.form.emergencyContact")}
            description={isCreate ? t("patients.form.emergencyContactDesc") : undefined}
          />

          <Field label={t("patients.form.name")}>
            <Input {...register("emergencyName")} />
          </Field>
          <Field label={t("patients.form.phone")} error={errors.emergencyPhone?.message}>
            <Controller
              control={control}
              name="emergencyPhone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── Card 3: Medical ── */}
      <PatientMedicalCard form={form} isCreate={isCreate} />

    </div>
  )
}
