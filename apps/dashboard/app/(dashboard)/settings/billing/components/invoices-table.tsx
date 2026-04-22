"use client"

import { Badge, Card, Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { InvoiceStatus, SubscriptionInvoice } from "@/lib/types/billing"

/* ─── Status badge ─── */

const invoiceStatusStyles: Record<InvoiceStatus, { bg: string; text: string; border: string; label: { ar: string; en: string } }> = {
  PAID:  { bg: "bg-success/10",     text: "text-success",        border: "border-success/30",     label: { ar: "مدفوعة",  en: "Paid"    } },
  DUE:   { bg: "bg-destructive/10", text: "text-destructive",    border: "border-destructive/30", label: { ar: "مستحقة",  en: "Due"     } },
  FAILED:{ bg: "bg-destructive/10", text: "text-destructive",    border: "border-destructive/30", label: { ar: "فشل",     en: "Failed"  } },
  DRAFT: { bg: "bg-muted",          text: "text-muted-foreground", border: "border-border",       label: { ar: "مسودة",   en: "Draft"   } },
  VOID:  { bg: "bg-muted",          text: "text-muted-foreground", border: "border-border",       label: { ar: "ملغاة",   en: "Void"    } },
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const s = invoiceStatusStyles[status]
  return (
    <Badge variant="outline" className={cn("font-medium", s.bg, s.text, s.border)}>
      {isAr ? s.label.ar : s.label.en}
    </Badge>
  )
}

/* ─── Helpers ─── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
  })
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

/* ─── Main component ─── */

interface InvoicesTableProps {
  invoices?: SubscriptionInvoice[]
  isLoading: boolean
}

export function InvoicesTable({ invoices, isLoading }: InvoicesTableProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Card>
    )
  }

  const rows = invoices ?? []

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-base font-semibold text-foreground">
        {isAr ? "الفواتير" : "Invoices"}
      </h3>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {isAr ? "لا توجد فواتير بعد" : "No invoices yet"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 text-start font-medium ps-0">
                  {isAr ? "التاريخ" : "Date"}
                </th>
                <th className="pb-2 text-start font-medium">
                  {isAr ? "الفترة" : "Period"}
                </th>
                <th className="pb-2 text-end font-medium">
                  {isAr ? "المبلغ" : "Amount"}
                </th>
                <th className="pb-2 text-end font-medium pe-0">
                  {isAr ? "الحالة" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((inv) => (
                <tr key={inv.id} className="group">
                  <td className="py-3 text-foreground ps-0">
                    {formatDate(inv.dueDate)}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatPeriod(inv.periodStart, inv.periodEnd)}
                  </td>
                  <td className="py-3 text-end font-medium tabular-nums text-foreground">
                    {inv.currency} {inv.amount}
                  </td>
                  <td className="py-3 text-end pe-0">
                    <div className="flex justify-end">
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
