"use client"

import { Badge, Card, Skeleton } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { formatBillingDate } from "@/lib/billing/utils"
import type { InvoiceStatus, SubscriptionInvoice } from "@/lib/types/billing"

const statusKeyMap: Record<InvoiceStatus, string> = {
  PAID: "billing.invoices.status.paid",
  DUE: "billing.invoices.status.due",
  FAILED: "billing.invoices.status.failed",
  DRAFT: "billing.invoices.status.draft",
  VOID: "billing.invoices.status.void",
}

const statusClassNames: Record<InvoiceStatus, string> = {
  PAID: "border-success/30 bg-success/10 text-success",
  DUE: "border-warning/30 bg-warning/10 text-warning",
  FAILED: "border-error/30 bg-error/10 text-error",
  DRAFT: "border-border bg-muted text-muted-foreground",
  VOID: "border-border bg-muted text-muted-foreground",
}

interface InvoicesTableProps {
  invoices?: SubscriptionInvoice[]
  isLoading: boolean
}

export function InvoicesTable({ invoices, isLoading }: InvoicesTableProps) {
  const { t, locale } = useLocale()

  if (isLoading) {
    return (
      <Card className="space-y-4 p-6">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </Card>
    )
  }

  const rows = invoices ?? []

  return (
    <Card className="space-y-4 p-6">
      <h3 className="text-base font-semibold text-foreground">
        {t("billing.invoices.title")}
      </h3>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("billing.invoices.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 text-start font-medium ps-0">
                  {t("billing.invoices.date")}
                </th>
                <th className="pb-2 text-start font-medium">
                  {t("billing.invoices.period")}
                </th>
                <th className="pb-2 text-end font-medium">
                  {t("billing.invoices.amount")}
                </th>
                <th className="pb-2 text-end font-medium pe-0">
                  {t("billing.invoices.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="py-3 text-foreground ps-0">
                    {formatBillingDate(invoice.dueDate, locale)}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatBillingDate(invoice.periodStart, locale)} -{" "}
                    {formatBillingDate(invoice.periodEnd, locale)}
                  </td>
                  <td className="py-3 text-end font-medium tabular-nums text-foreground">
                    {invoice.currency} {invoice.amount}
                  </td>
                  <td className="py-3 text-end pe-0">
                    <div className="flex justify-end">
                      <Badge
                        variant="outline"
                        className={cn("font-medium", statusClassNames[invoice.status])}
                      >
                        {t(statusKeyMap[invoice.status])}
                      </Badge>
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
