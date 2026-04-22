import { Badge } from "@carekit/ui"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { ClientBookingPreview } from "@/lib/types/client"

interface Props {
  booking: ClientBookingPreview
  locale: "ar" | "en"
  t: (k: string) => string
}

export function ClientInvoiceRow({ booking, locale, t }: Props) {
  if (!booking.payment) return null

  const serviceName = locale === "ar" ? booking.service.nameAr : booking.service.nameEn
  const paidStyle = booking.payment.status === "paid"
    ? "border-success/30 bg-success/10 text-success"
    : "border-warning/30 bg-warning/10 text-warning"

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{serviceName}</span>
        <span className="font-numeric text-xs text-muted-foreground">
          {new Date(booking.date).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-numeric text-sm font-semibold text-foreground">
          <FormattedCurrency amount={booking.payment.totalAmount} locale={locale} decimals={2} />
        </span>
        <Badge variant="outline" className={paidStyle}>
          {t(`clients.dialog.paymentStatus.${booking.payment.status}`) || booking.payment.status}
        </Badge>
      </div>
    </div>
  )
}
