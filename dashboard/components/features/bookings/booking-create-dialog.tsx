"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import { PatientStep } from "./booking-patient-step"
import { BookingStep, type BookingFormData } from "./booking-details-step"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useLocale } from "@/components/locale-provider"

/* ── Props ── */

interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

/* ── Step indicator ── */

function StepIndicator({ step }: { step: 1 | 2 }) {
  const { t } = useLocale()
  // Steps in logical order — flex renders RTL naturally in Arabic context
  const steps = [
    { s: 1 as const, label: t("bookings.create.stepLabel.patient") },
    { s: 2 as const, label: t("bookings.create.stepLabel.booking") },
  ]
  return (
    <div className="flex items-center gap-3 mt-1 w-fit">
      {steps.map(({ s, label }, i) => {
        const active = step === s
        const done = step > s
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div className={cn("h-px w-8 transition-colors", done ? "bg-primary" : "bg-border")} />
            )}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground" :
                done   ? "bg-primary/20 text-primary" :
                         "bg-border text-muted-foreground"
              )}>{s}</span>
              <span className={cn(
                "text-xs transition-colors",
                active ? "text-foreground font-medium" :
                done   ? "text-primary" :
                         "text-muted-foreground"
              )}>{label}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ── Main Dialog ── */

export function BookingCreateDialog({ open, onOpenChange, onSuccess }: BookingCreateDialogProps) {
  const { t } = useLocale()
  const [step, setStep] = useState<1 | 2>(1)
  const [patientId, setPatientId] = useState("")
  const [patientName, setPatientName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { createMut } = useBookingMutations()

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1)
      setPatientId("")
      setPatientName("")
    }
  }, [open])

  const handlePatientSelected = (id: string, name: string) => {
    setPatientId(id)
    setPatientName(name)
    setStep(2)
  }

  const handleBookingSubmit = async (data: BookingFormData) => {
    setSubmitting(true)
    try {
      await createMut.mutateAsync({
        patientId,
        practitionerId:   data.practitionerId,
        serviceId:        data.serviceId,
        type:             data.type,
        durationOptionId: data.durationOptionId || undefined,
        date:             data.date,
        startTime:        data.startTime,
        payAtClinic:      data.payAtClinic || undefined,
      })
      toast.success(t("bookings.create.toast.success"))
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookings.create.toast.error"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t("bookings.create.dialogTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("bookings.create.dialogDescription")}</DialogDescription>
          <div className="mt-2">
            <StepIndicator step={step} />
          </div>
        </DialogHeader>

        <div className="px-5 py-4 overflow-y-auto">
          {step === 1 ? (
            <PatientStep onSelect={handlePatientSelected} />
          ) : (
            <BookingStep
              patientName={patientName}
              onSubmit={handleBookingSubmit}
              submitting={submitting}
            />
          )}
        </div>

        {step === 2 && (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="w-fit text-muted-foreground hover:text-foreground"
            >
              {t("bookings.create.changePatient")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
