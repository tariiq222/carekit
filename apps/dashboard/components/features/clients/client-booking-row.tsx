import { Badge } from "@/components/ui/badge"
import type { PatientBookingPreview } from "@/lib/types/patient"

const STATUS_STYLES: Record<string, string> = {
  completed:            "border-success/30 bg-success/10 text-success",
  confirmed:            "border-info/30 bg-info/10 text-info",
  pending:              "border-warning/30 bg-warning/10 text-warning",
  cancelled:            "border-destructive/30 bg-destructive/10 text-destructive",
  pending_cancellation: "border-warning/30 bg-warning/10 text-warning",
}

interface Props {
  booking: PatientBookingPreview
  locale: "ar" | "en"
  t: (k: string) => string
}

export function PatientBookingRow({ booking, locale, t }: Props) {
  const serviceName = locale === "ar" ? booking.service.nameAr : booking.service.nameEn
  const practitionerName = `${booking.practitioner.user.firstName} ${booking.practitioner.user.lastName}`
  const statusStyle = STATUS_STYLES[booking.status] ?? "border-border bg-surface-muted text-muted-foreground"

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{serviceName}</span>
        <span className="text-xs text-muted-foreground truncate">{practitionerName}</span>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-numeric text-xs text-muted-foreground">
          {new Date(booking.date).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
        </span>
        <Badge variant="outline" className={statusStyle}>
          {t(`patients.dialog.status.${booking.status}`) || booking.status}
        </Badge>
      </div>
    </div>
  )
}
