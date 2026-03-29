"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAdd01Icon,
  User03Icon,
  Call02Icon,
  UserCircleIcon,
  IdentificationIcon,
  Location04Icon,
  BloodIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NationalitySelect } from "@/components/ui/nationality-select"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { createWalkInPatient } from "@/lib/api/patients"
import { cn } from "@/lib/utils"
import { BLOOD_TYPES, BLOOD_LABELS } from "@/lib/schemas/patient.schema"
import {
  walkInPatientSchema,
  type WalkInPatientFormData,
} from "@/lib/schemas/booking.schema"

/* ── Card styles ── */

const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
const cardHeader = "px-4 py-3 bg-surface border-b border-border"
const cardTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const cardBody = "px-4 py-4 flex flex-col gap-3"

/* ── FormField ── */

function FormField({
  label,
  error,
  children,
  icon,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/* ── Step indicator ── */

function StepIndicator({ step }: { step: 1 | 2 }) {
  const labels = ["البيانات الشخصية والتواصل", "المعلومات الطبية"]
  return (
    <div className="flex items-center gap-3 w-fit">
      {([1, 2] as const).map((s, i) => {
        const active = step === s
        const done = step > s
        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div className={cn("h-px w-8 transition-colors", done ? "bg-primary" : "bg-border")} />
            )}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground" :
                done   ? "bg-primary/20 text-primary" :
                         "bg-border text-muted-foreground"
              )}>{s}</span>
              <span className={cn(
                "text-xs transition-colors whitespace-nowrap",
                active ? "text-foreground font-medium" :
                done   ? "text-primary" :
                         "text-muted-foreground"
              )}>{labels[i]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Props ── */

interface BookingWalkInFormProps {
  onSelect: (patientId: string, name: string) => void
}

/* ── Step 1 fields for partial validation ── */

const step1Fields = ["firstName", "lastName", "phone"] as const

/* ── Main form ── */

export function BookingWalkInForm({ onSelect }: BookingWalkInFormProps) {
  const form = useForm<WalkInPatientFormData>({ resolver: zodResolver(walkInPatientSchema) })
  const [step, setStep] = useState<1 | 2>(1)
  const [creating, setCreating] = useState(false)

  const bloodType = form.watch("bloodType")

  const goNext = async () => {
    const valid = await form.trigger(step1Fields)
    if (valid) setStep(2)
  }

  const handleCreate = form.handleSubmit(async (data) => {
    setCreating(true)
    try {
      const res = await createWalkInPatient(data)
      toast.success(res.isExisting ? "تم العثور على المريض" : "تم إنشاء حساب المريض")
      onSelect(res.id, `${data.firstName} ${data.lastName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إنشاء المريض")
    } finally {
      setCreating(false)
    }
  })

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-3">

      <StepIndicator step={step} />

      {/* Step 1: Personal info + Contact */}
      {step === 1 && (
        <>
          <div className={card}>
            <div className={cardHeader}><p className={cardTitle}>المعلومات الشخصية</p></div>
            <div className={cardBody}>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="الاسم الأول *" icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />} error={form.formState.errors.firstName?.message}>
                  <Input {...form.register("firstName")} placeholder="محمد" className="bg-surface-muted" />
                </FormField>
                <FormField label="الاسم الأوسط" icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />}>
                  <Input {...form.register("middleName")} placeholder="عبدالله" className="bg-surface-muted" />
                </FormField>
                <FormField label="اسم العائلة *" icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />} error={form.formState.errors.lastName?.message}>
                  <Input {...form.register("lastName")} placeholder="الأحمد" className="bg-surface-muted" />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="الجنس" icon={<HugeiconsIcon icon={UserCircleIcon} size={13} className="shrink-0" />}>
                  <Controller control={form.control} name="gender" render={({ field }) => (
                    <div className="flex gap-2">
                      {(["male", "female"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => field.onChange(field.value === g ? undefined : g)}
                          className={cn(
                            "flex-1 rounded-md border py-2 text-xs font-medium transition-colors",
                            field.value === g
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-surface-muted text-muted-foreground hover:border-border-strong"
                          )}
                        >
                          {g === "male" ? "ذكر" : "أنثى"}
                        </button>
                      ))}
                    </div>
                  )} />
                </FormField>
                <FormField label="تاريخ الميلاد">
                  <Controller control={form.control} name="dateOfBirth" render={({ field }) => (
                    <DatePicker value={field.value ?? ""} onChange={field.onChange} placeholder="اختياري" className="w-full bg-surface-muted" />
                  )} />
                </FormField>
                <FormField label="الجنسية" icon={<HugeiconsIcon icon={Location04Icon} size={13} className="shrink-0" />}>
                  <Controller control={form.control} name="nationality" defaultValue="السعودية" render={({ field }) => (
                    <NationalitySelect
                      value={field.value ?? "السعودية"}
                      onChange={field.onChange}
                      locale="ar"
                    />
                  )} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="رقم الهوية / الإقامة" icon={<HugeiconsIcon icon={IdentificationIcon} size={13} className="shrink-0" />}>
                  <Input {...form.register("nationalId")} placeholder="1XXXXXXXXX" className="bg-surface-muted" dir="ltr" />
                </FormField>
                <FormField label="رقم الجوال *" icon={<HugeiconsIcon icon={Call02Icon} size={13} className="shrink-0" />} error={form.formState.errors.phone?.message}>
                  <Controller control={form.control} name="phone" render={({ field }) => (
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
                  )} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="اسم جهة الطوارئ">
                  <Input {...form.register("emergencyName")} placeholder="اختياري" className="bg-surface-muted" />
                </FormField>
                <FormField label="جوال الطوارئ" error={form.formState.errors.emergencyPhone?.message}>
                  <Controller control={form.control} name="emergencyPhone" render={({ field }) => (
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
                  )} />
                </FormField>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={goNext}>
              التالي
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="ms-1.5" />
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Medical info */}
      {step === 2 && (
        <>
          <div className={card}>
            <div className={cardHeader}><p className={cardTitle}>المعلومات الطبية</p></div>
            <div className={cardBody}>
              <FormField label="فصيلة الدم" icon={<HugeiconsIcon icon={BloodIcon} size={13} className="shrink-0" />}>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_TYPES.filter((b) => b !== "UNKNOWN").map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => form.setValue("bloodType", bloodType === b ? undefined : b)}
                      className={cn(
                        "rounded-lg border py-1.5 text-xs font-semibold font-numeric transition-colors",
                        bloodType === b
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface-muted text-muted-foreground hover:border-border-strong"
                      )}
                    >
                      {BLOOD_LABELS[b]}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="الحساسية">
                <Textarea {...form.register("allergies")} placeholder="اذكر أي حساسية دوائية أو غذائية..." rows={2} className="bg-surface-muted resize-none" />
              </FormField>
              <FormField label="الأمراض المزمنة">
                <Textarea {...form.register("chronicConditions")} placeholder="مثال: السكري، ضغط الدم..." rows={2} className="bg-surface-muted resize-none" />
              </FormField>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground">
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="me-1.5" />
              السابق
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              <HugeiconsIcon icon={UserAdd01Icon} size={14} className="me-1.5" />
              {creating ? "جاري الإنشاء..." : "إنشاء المريض والمتابعة"}
            </Button>
          </div>
        </>
      )}

    </form>
  )
}
