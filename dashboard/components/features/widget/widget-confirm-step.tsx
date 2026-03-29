"use client"

/**
 * Widget Confirm Step — Review booking summary and confirm
 * Also handles the success state after booking is created.
 */

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  Building01Icon,
  Video01Icon,
  Calendar03Icon,
  Clock01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { BookingType } from "@/lib/types/booking"

/* ─── Booking type labels ─── */

const TYPE_LABELS: Record<BookingType, { ar: string; en: string; icon: React.ReactNode }> = {
  in_person: { ar: "زيارة حضورية", en: "In Person", icon: <HugeiconsIcon icon={Building01Icon} size={16} /> },
  online: { ar: "عن بعد", en: "Online", icon: <HugeiconsIcon icon={Video01Icon} size={16} /> },
  walk_in: { ar: "زيارة مباشرة", en: "Walk-in", icon: <HugeiconsIcon icon={Building01Icon} size={16} /> },
}

/* ─── Price helper ─── */

function getPrice(booking: ReturnType<typeof useWidgetBooking>): number {
  const { state } = booking
  if (state.durationOption) return state.durationOption.price
  if (state.service) return state.service.price
  return 0
}

/* ─── Props ─── */

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
}

export function WidgetConfirmStep({ locale, booking }: Props) {
  const { state, confirmBooking, isConfirming, confirmError } = booking
  const [notes, setNotes] = useState("")
  const isRtl = locale === "ar"

  const { practitioner, service, bookingType, date, slot } = state
  const price = getPrice(booking)
  const vat = Math.round(price * 0.15 * 100) / 100
  const total = price + vat

  /* ─── Success view ─── */
  if (state.step === "success" && state.booking) {
    return (
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={32} className="text-success" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">
            {isRtl ? "تم الحجز بنجاح!" : "Booking Confirmed!"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl
              ? "سيتم إرسال تأكيد على بريدك الإلكتروني"
              : "A confirmation will be sent to your email"}
          </p>
        </div>
        <div className="w-full bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
          <SummaryRow
            icon={<HugeiconsIcon icon={Calendar03Icon} size={14} />}
            label={isRtl ? "التاريخ" : "Date"}
            value={date}
          />
          <SummaryRow
            icon={<HugeiconsIcon icon={Clock01Icon} size={14} />}
            label={isRtl ? "الوقت" : "Time"}
            value={`${slot?.startTime} — ${slot?.endTime}`}
          />
          <Separator />
          <div className="flex justify-between font-medium">
            <span>{isRtl ? "رقم الحجز" : "Booking ID"}</span>
            <span className="text-xs font-mono text-muted-foreground">
              {state.booking.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Confirm view ─── */
  const typeConfig = bookingType ? TYPE_LABELS[bookingType] : null

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isRtl ? "مراجعة تفاصيل الحجز" : "Review booking details"}
      </p>

      {/* Summary card */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3 text-sm">
        {practitioner && (
          <SummaryRow
            label={isRtl ? "الطبيب" : "Practitioner"}
            value={
              isRtl && practitioner.nameAr
                ? practitioner.nameAr
                : `${practitioner.user.firstName} ${practitioner.user.lastName}`
            }
          />
        )}
        {service && (
          <SummaryRow
            label={isRtl ? "الخدمة" : "Service"}
            value={isRtl ? service.nameAr : service.nameEn}
          />
        )}
        {typeConfig && (
          <SummaryRow
            icon={typeConfig.icon}
            label={isRtl ? "نوع الزيارة" : "Visit Type"}
            value={isRtl ? typeConfig.ar : typeConfig.en}
          />
        )}
        <Separator />
        <SummaryRow
          icon={<HugeiconsIcon icon={Calendar03Icon} size={14} />}
          label={isRtl ? "التاريخ" : "Date"}
          value={date}
        />
        {slot && (
          <SummaryRow
            icon={<HugeiconsIcon icon={Clock01Icon} size={14} />}
            label={isRtl ? "الوقت" : "Time"}
            value={`${slot.startTime} — ${slot.endTime}`}
          />
        )}
        <Separator />
        <SummaryRow
          label={isRtl ? "السعر" : "Price"}
          value={`${price} ${isRtl ? "ر.س" : "SAR"}`}
        />
        <SummaryRow
          label={isRtl ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}
          value={`${vat} ${isRtl ? "ر.س" : "SAR"}`}
        />
        <div className={cn("flex justify-between font-semibold text-primary")}>
          <span>{isRtl ? "الإجمالي" : "Total"}</span>
          <span>{total} {isRtl ? "ر.س" : "SAR"}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {isRtl ? "ملاحظات (اختياري)" : "Notes (optional)"}
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          className="text-sm resize-none"
          placeholder={isRtl ? "أي ملاحظات للطبيب..." : "Any notes for the practitioner..."}
        />
      </div>

      {confirmError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {isRtl ? "حدث خطأ أثناء الحجز. يرجى المحاولة مجدداً." : "Booking failed. Please try again."}
        </p>
      )}

      <Button
        className="w-full"
        disabled={isConfirming}
        onClick={() => confirmBooking(notes || undefined)}
      >
        {isConfirming && <HugeiconsIcon icon={Loading03Icon} size={16} className="me-2" />}
        {isRtl ? "تأكيد الحجز" : "Confirm Booking"}
      </Button>
    </div>
  )
}

/* ─── Summary row helper ─── */

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-end">{value}</span>
    </div>
  )
}
