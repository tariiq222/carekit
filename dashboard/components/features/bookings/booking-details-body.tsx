"use client"

import {
  User03Icon,
  Call02Icon,
  Mail01Icon,
  Stethoscope02Icon,
  MedicineBottle01Icon,
  Calendar03Icon,
  Clock01Icon,
  Timer02Icon,
  Money02Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { DetailRow } from "@/components/features/detail-sheet-parts"
import { cn } from "@/lib/utils"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { Booking, CancelledBy } from "@/lib/types/booking"

/* ── CancelledByBadge ── */

const cancelledByStyles: Record<CancelledBy, string> = {
  patient: "border-warning/30 bg-warning/10 text-warning",
  admin:   "border-primary/30 bg-primary/10 text-primary",
  system:  "border-border bg-surface-muted text-muted-foreground",
}

export function CancelledByBadge({ cancelledBy, t }: { cancelledBy: CancelledBy; t: (key: string) => string }) {
  return (
    <Badge variant="outline" className={cn("text-xs", cancelledByStyles[cancelledBy])}>
      {t(`detail.cancelledBy.${cancelledBy}`)}
    </Badge>
  )
}

/* ── PaymentStatusBadge + PaymentMethodBadge ── */

const paymentStatusClasses: Record<string, string> = {
  pending:  "border-warning/30 bg-warning/10 text-warning",
  awaiting: "border-info/20 bg-info/10 text-info",
  paid:     "border-success/30 bg-success/10 text-success",
  failed:   "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-refunded/30 bg-refunded/10 text-refunded",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
}

function PaymentStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const className = paymentStatusClasses[status] ?? "border-border bg-muted text-muted-foreground"
  const label = t(`detail.paymentStatus.${status}`) || status
  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {label}
    </Badge>
  )
}

function PaymentMethodBadge({ method, t }: { method: string; t: (key: string) => string }) {
  const label = t(`detail.paymentMethod.${method}`) || method
  return (
    <Badge variant="outline" className="text-xs border-border bg-muted text-foreground">
      {label}
    </Badge>
  )
}

/* ── Details body (shared) ── */

interface DetailsBodyProps {
  booking: Booking
  patientName: string
  practitionerName: string
  specialty: string
  appointmentDate: string
  t: (key: string) => string
}

export function DetailsBody({ booking, patientName, practitionerName, specialty, appointmentDate, t }: DetailsBodyProps) {
  const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
  const cardHeader = "px-4 py-2.5 bg-muted/50 border-b border-border"
  const cardTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
  const cardBody = "px-4 py-3 flex flex-col gap-2.5"

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.patient")}</p></div>
          <div className={cardBody}>
            <DetailRow label={t("detail.name")} value={patientName} icon={User03Icon} />
            <DetailRow label={t("detail.phone")} value={booking.patient?.phone ?? "—"} numeric icon={Call02Icon} />
            <DetailRow label={t("detail.email")} value={booking.patient?.email ?? "—"} icon={Mail01Icon} />
          </div>
        </div>

        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.practitioner")}</p></div>
          <div className={cardBody}>
            <DetailRow label={t("detail.name")} value={practitionerName} icon={User03Icon} />
            <DetailRow label={t("detail.specialty")} value={specialty} icon={Stethoscope02Icon} />
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${booking.payment ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.appointment")}</p></div>
          <div className={cardBody}>
            <DetailRow label={t("detail.service")} value={booking.service?.nameEn ?? "—"} icon={MedicineBottle01Icon} />
            <DetailRow label={t("detail.date")} value={appointmentDate} numeric icon={Calendar03Icon} />
            <DetailRow label={t("detail.time")} value={`${booking.startTime} — ${booking.endTime}`} numeric icon={Clock01Icon} />
            <DetailRow label={t("detail.duration")} value={`${booking.service?.duration ?? 0} min`} numeric icon={Timer02Icon} />
          </div>
        </div>

        {booking.payment && (
          <div className={card}>
            <div className={cardHeader}><p className={cardTitle}>{t("detail.payment")}</p></div>
            <div className={cardBody}>
              <DetailRow
                label={t("detail.amount")}
                value={<FormattedCurrency amount={booking.payment.totalAmount} locale="ar" decimals={2} />}
                numeric
                icon={Money02Icon}
              />
              <DetailRow
                label={t("detail.status")}
                value={<PaymentStatusBadge status={booking.payment.status} t={t} />}
                icon={CheckmarkCircle02Icon}
              />
              <DetailRow
                label={t("detail.method")}
                value={booking.payment.method ? <PaymentMethodBadge method={booking.payment.method} t={t} /> : "—"}
                icon={CreditCardIcon}
              />
            </div>
          </div>
        )}
      </div>

      {booking.notes && (
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.notes")}</p></div>
          <div className={cardBody}>
            <p className="text-sm text-muted-foreground leading-relaxed">{booking.notes}</p>
          </div>
        </div>
      )}

      {(booking.cancellationReason || booking.cancelledBy) && (
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.cancellationReason")}</p></div>
          <div className={cardBody}>
            {booking.cancelledBy && (
              <DetailRow
                label={t("detail.cancelledBy")}
                value={<CancelledByBadge cancelledBy={booking.cancelledBy} t={t} />}
              />
            )}
            {booking.cancellationReason && (
              <p className="text-sm text-error">{booking.cancellationReason}</p>
            )}
            {booking.suggestedRefundType && (
              <DetailRow
                label={t("detail.suggestedRefund")}
                value={
                  <Badge variant="outline" className="text-xs">
                    {t(`detail.suggestedRefund.${booking.suggestedRefundType}`)}
                  </Badge>
                }
              />
            )}
          </div>
        </div>
      )}

      {booking.zoomJoinUrl && (
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.videoCall")}</p></div>
          <div className={cardBody}>
            <a
              href={booking.zoomJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {t("detail.joinZoom")}
            </a>
          </div>
        </div>
      )}

      {booking.rescheduledFrom && (
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("detail.rescheduledFrom")}</p></div>
          <div className={cardBody}>
            <DetailRow label={t("detail.previousDate")} value={booking.rescheduledFrom.date} numeric icon={Calendar03Icon} />
            <DetailRow label={t("detail.previousTime")} value={booking.rescheduledFrom.startTime} numeric icon={Clock01Icon} />
          </div>
        </div>
      )}
    </div>
  )
}
