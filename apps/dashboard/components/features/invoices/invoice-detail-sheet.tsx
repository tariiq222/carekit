"use client"

import { useQuery } from "@tanstack/react-query"
import { ar } from "date-fns/locale"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { fetchInvoice } from "@/lib/api/invoices"
import { queryKeys } from "@/lib/query-keys"
import type { Invoice } from "@/lib/types/invoice"
import { useLocale } from "@/components/locale-provider"
import { formatDatePattern } from "@/lib/date"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { InvoiceActions } from "./invoice-actions"

/* ─── ZATCA Styles ─── */

const zatcaStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  submitted: "border-info/30 bg-info/10 text-info",
  accepted: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
}

/* ─── Props ─── */

interface InvoiceDetailSheetProps {
  invoiceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: () => void
}

/* ─── Component ─── */

export function InvoiceDetailSheet({
  invoiceId,
  open,
  onOpenChange,
  onAction,
}: InvoiceDetailSheetProps) {
  const { t } = useLocale()
  const { data: invoice, isLoading } = useQuery({
    queryKey: queryKeys.invoices.detail(invoiceId ?? ""),
    queryFn: () => fetchInvoice(invoiceId!),
    enabled: !!invoiceId && open,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("invoices.detail.title")}</SheetTitle>
          <SheetDescription>
            {invoice ? (
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-foreground">
                  {invoice.invoiceNumber}
                </span>
                <Badge
                  variant="outline"
                  className={zatcaStyles[invoice.zatcaStatus] ?? ""}
                >
                  {t(`invoices.zatcaStatus.${invoice.zatcaStatus}`) || invoice.zatcaStatus}
                </Badge>
              </span>
            ) : (
              t("invoices.detail.loading")
            )}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {isLoading ? (
            <div className="flex flex-col gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : invoice ? (
            <InvoiceDetailContent invoice={invoice} />
          ) : null}
        </SheetBody>

        {invoice && (
          <SheetFooter>
            <InvoiceActions invoice={invoice} onAction={onAction} />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ─── Detail Content ─── */

function InvoiceDetailContent({ invoice }: { invoice: Invoice }) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"

  const clientName = invoice.payment?.booking?.client
    ? `${invoice.payment.booking.client.firstName} ${invoice.payment.booking.client.lastName}`
    : "\u2014"

  const employeeName = invoice.payment?.booking?.employee?.user
    ? `${invoice.payment.booking.employee.user.firstName} ${invoice.payment.booking.employee.user.lastName}`
    : "\u2014"

  const serviceName = invoice.payment?.booking?.service
    ? (isAr ? invoice.payment.booking.service.nameAr : invoice.payment.booking.service.nameEn)
    : "\u2014"

  return (
    <div className="flex flex-col gap-6">
      {/* Amounts */}
      <DetailSection title={t("invoices.detail.amounts")}>
        <DetailRow
          label={t("invoices.detail.subtotal")}
          value={<FormattedCurrency amount={invoice.subtotal} locale={locale} decimals={2} />}
          numeric
        />
        <DetailRow
          label={t("invoices.detail.vat")}
          value={<FormattedCurrency amount={invoice.taxAmount} locale={locale} decimals={2} />}
          numeric
        />
        <DetailRow
          label={t("invoices.detail.total")}
          value={<FormattedCurrency amount={invoice.totalAmount} locale={locale} decimals={2} />}
          numeric
        />
      </DetailSection>

      <Separator />

      {/* ZATCA */}
      <DetailSection title={t("invoices.detail.zatca")}>
        <DetailRow
          label={t("invoices.detail.status")}
          value={t(`invoices.zatcaStatus.${invoice.zatcaStatus}`) || invoice.zatcaStatus}
        />
        {invoice.zatcaHash && (
          <DetailRow
            label={t("invoices.detail.hash")}
            value={invoice.zatcaHash.slice(0, 16) + "..."}
            numeric
          />
        )}
        {invoice.sentAt && (
          <DetailRow
            label={t("invoices.detail.sentAt")}
            value={formatDatePattern(invoice.sentAt, "PPp", { locale: isAr ? ar : undefined })}
            numeric
          />
        )}
      </DetailSection>

      {/* QR Code */}
      {invoice.qrCode && (
        <>
          <Separator />
          <DetailSection title={t("invoices.detail.qrCode")}>
            <div className="flex justify-center rounded-lg border bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invoice.qrCode}
                alt={t("invoices.detail.qrCode")}
                className="size-32"
              />
            </div>
          </DetailSection>
        </>
      )}

      <Separator />

      {/* Booking Info */}
      <DetailSection title={t("invoices.detail.booking")}>
        <DetailRow label={t("invoices.detail.client")} value={clientName} />
        <DetailRow label={t("invoices.detail.employee")} value={employeeName} />
        <DetailRow label={t("invoices.detail.service")} value={serviceName} />
        <DetailRow
          label={t("invoices.detail.date")}
          value={
            invoice.payment?.booking?.date
              ? formatDatePattern(invoice.payment.booking.date, "PP", { locale: isAr ? ar : undefined })
              : "\u2014"
          }
          numeric
        />
      </DetailSection>

      <Separator />

      {/* Payment Info */}
      <DetailSection title={t("invoices.detail.payment")}>
        <DetailRow label={t("invoices.detail.method")} value={invoice.payment?.method ?? "\u2014"} />
        <DetailRow label={t("invoices.detail.status")} value={invoice.payment?.status ?? "\u2014"} />
      </DetailSection>
    </div>
  )
}
