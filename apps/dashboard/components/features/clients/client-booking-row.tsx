import { Badge } from "@carekit/ui"
import { formatLocaleDate } from "@/lib/date"
import type { ClientBookingPreview } from "@/lib/types/client"

const STATUS_STYLES: Record<string, string> = {
  completed:            "border-success/30 bg-success/10 text-success",
  confirmed:            "border-info/30 bg-info/10 text-info",
  pending:              "border-warning/30 bg-warning/10 text-warning",
  pending_group_fill:   "border-warning/30 bg-warning/10 text-warning",
  awaiting_payment:     "border-warning/30 bg-warning/10 text-warning",
  cancelled:            "border-destructive/30 bg-destructive/10 text-destructive",
  cancel_requested:     "border-warning/30 bg-warning/10 text-warning",
}

interface Props {
  booking: ClientBookingPreview
  locale: "ar" | "en"
  t: (k: string) => string
}

export function ClientBookingRow({ booking, locale, t }: Props) {
  const serviceName = locale === "ar" ? booking.service.nameAr : booking.service.nameEn
  const employeeName = `${booking.employee.user.firstName} ${booking.employee.user.lastName}`
  const statusStyle = STATUS_STYLES[booking.status] ?? "border-border bg-surface-muted text-muted-foreground"

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{serviceName}</span>
        <span className="text-xs text-muted-foreground truncate">{employeeName}</span>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-numeric text-xs text-muted-foreground">
          {formatLocaleDate(booking.date, locale)}
        </span>
        <Badge variant="outline" className={statusStyle}>
          {t(`clients.dialog.status.${booking.status}`) || booking.status}
        </Badge>
      </div>
    </div>
  )
}
