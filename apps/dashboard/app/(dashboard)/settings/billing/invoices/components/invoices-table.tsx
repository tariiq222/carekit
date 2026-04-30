"use client"

import { useMemo } from "react"
import { Download04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useDownloadBillingInvoice } from "@/hooks/use-billing-invoices"
import type { Invoice, InvoiceStatus } from "@/lib/types/billing"

interface Props {
  invoices: Invoice[]
  isLoading?: boolean
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  PAID: "bg-success/10 text-success border-success/30",
  DUE: "bg-warning/10 text-warning border-warning/30",
  FAILED: "bg-destructive/10 text-destructive border-destructive/30",
  VOID: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
}

function formatDate(iso: string | null, locale: "ar" | "en"): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function InvoicesTable({ invoices, isLoading }: Props) {
  const { t, locale } = useLocale()
  const download = useDownloadBillingInvoice()

  const skeletonRows = useMemo(() => Array.from({ length: 5 }), [])

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("billing.invoices.column.number")}</TableHead>
            <TableHead>{t("billing.invoices.column.date")}</TableHead>
            <TableHead>{t("billing.invoices.column.period")}</TableHead>
            <TableHead>{t("billing.invoices.column.amount")}</TableHead>
            <TableHead>{t("billing.invoices.column.status")}</TableHead>
            <TableHead>{t("billing.invoices.column.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skeletonRows.map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={6}>
                <Skeleton className="h-12 w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("billing.invoices.column.number")}</TableHead>
            <TableHead>{t("billing.invoices.column.date")}</TableHead>
            <TableHead>{t("billing.invoices.column.period")}</TableHead>
            <TableHead>{t("billing.invoices.column.amount")}</TableHead>
            <TableHead>{t("billing.invoices.column.status")}</TableHead>
            <TableHead className="w-[88px] text-end">
              {t("billing.invoices.column.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map(inv => {
            const issued = inv.issuedAt !== null
            const disabled = !issued || download.isPending
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-numeric">
                  {inv.invoiceNumber ?? t("billing.invoices.notIssued")}
                </TableCell>
                <TableCell>{formatDate(inv.issuedAt, locale)}</TableCell>
                <TableCell>
                  {formatDate(inv.periodStart, locale)} →{" "}
                  {formatDate(inv.periodEnd, locale)}
                </TableCell>
                <TableCell className="font-numeric">
                  {inv.amount} {inv.currency}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE[inv.status]}
                  >
                    {t(`billing.invoices.status.${inv.status.toLowerCase()}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 rounded-sm"
                          disabled={disabled}
                          aria-label={t("billing.invoices.action.download")}
                          onClick={() => {
                            if (!disabled) download.mutate(inv.id)
                          }}
                        >
                          <HugeiconsIcon
                            icon={Download04Icon}
                            strokeWidth={1.8}
                            className="size-4"
                          />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!issued
                        ? t("billing.invoices.action.notIssuedYet")
                        : download.isPending
                          ? t("billing.invoices.action.downloading")
                          : t("billing.invoices.action.download")}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  )
}
