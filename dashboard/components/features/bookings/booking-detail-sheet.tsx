"use client"

import React from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { StatusBadge, BookingTypeBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import type { Booking } from "@/lib/types/booking"
import { BookingActions } from "./booking-actions"
import { DetailsBody } from "./booking-details-body"
import { BookingRescheduleTab } from "./booking-reschedule-tab"
import { BookingStatusLog } from "./booking-status-log"

/* ── Props ── */

interface BookingDetailSheetProps {
  booking: Booking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: () => void
  defaultTab?: "details" | "reschedule"
}

/* ── Main Dialog ── */

export function BookingDetailSheet({ booking, open, onOpenChange, onAction, defaultTab = "details" }: BookingDetailSheetProps) {
  const { locale, t } = useLocale()

  if (!booking) return null

  const patientName = booking.patient
    ? `${booking.patient.firstName} ${booking.patient.lastName}`
    : "—"

  const practitionerName = booking.practitioner?.user
    ? `${booking.practitioner.user.firstName} ${booking.practitioner.user.lastName}`
    : "—"

  const specialty = (locale === "ar"
    ? booking.practitioner?.specialtyAr
    : booking.practitioner?.specialty) || "—"

  const appointmentDate = new Date(booking.date).toLocaleDateString(
    locale === "ar" ? "ar-SA" : "en-US",
    { weekday: "short", year: "numeric", month: "short", day: "numeric" }
  )

  const canReschedule = !["completed", "cancelled", "no_show", "pending_cancellation", "in_progress", "expired"].includes(booking.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden flex flex-col">

        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("detail.bookingDetails")}
            </DialogTitle>
            <BookingActions booking={booking} onAction={onAction} />
          </div>
          <DialogDescription asChild>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="flex items-center gap-2">
                <BookingTypeBadge type={booking.type} />
                <StatusBadge status={booking.status} />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-surface-muted">
          {canReschedule ? (
            <Tabs defaultValue={defaultTab} className="h-full">
              <div className="px-6 pt-4">
                <TabsList className="h-8 p-0.5">
                  <TabsTrigger value="details" className="h-7 px-3 text-xs">{t("detail.tabs.details")}</TabsTrigger>
                  <TabsTrigger value="reschedule" className="h-7 px-3 text-xs">{t("detail.tabs.reschedule")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="details" className="px-6 pt-4 pb-6 flex flex-col gap-6">
                <DetailsBody
                  booking={booking}
                  patientName={patientName}
                  practitionerName={practitionerName}
                  specialty={specialty}
                  appointmentDate={appointmentDate}
                  t={t}
                />
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("bookings.statusLog.title")}
                  </p>
                  <BookingStatusLog bookingId={booking.id} />
                </div>
              </TabsContent>

              <TabsContent value="reschedule" className="px-6 pt-4 pb-6">
                <BookingRescheduleTab
                  booking={booking}
                  onSuccess={() => { onOpenChange(false); onAction() }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="px-6 pt-4 pb-6 flex flex-col gap-6">
              <DetailsBody
                booking={booking}
                patientName={patientName}
                practitionerName={practitionerName}
                specialty={specialty}
                appointmentDate={appointmentDate}
                t={t}
              />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("bookings.statusLog.title")}
                </p>
                <BookingStatusLog bookingId={booking.id} />
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
