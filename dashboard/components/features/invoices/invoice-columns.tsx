"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  ViewIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Invoice } from "@/lib/types/invoice"

const zatcaStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  submitted: "border-info/30 bg-info/10 text-info",
  accepted: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
}

interface InvoiceColumnCallbacks {
  onView: (invoice: Invoice) => void
  onSend: (invoice: Invoice) => void
}

export function getInvoiceColumns(
  callbacks?: InvoiceColumnCallbacks,
  t: (key: string) => string = (k) => k,
): ColumnDef<Invoice>[] {
  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: t("invoices.col.invoiceNo"),
      cell: ({ row }) => {
        const invoice = row.original
        return callbacks ? (
          <button
            className="text-sm font-medium text-primary underline-offset-2 hover:underline tabular-nums"
            onClick={() => callbacks.onView(invoice)}
          >
            {invoice.invoiceNumber}
          </button>
        ) : (
          <span className="tabular-nums text-sm font-medium text-foreground">
            {invoice.invoiceNumber}
          </span>
        )
      },
    },
    {
      id: "patient",
      header: t("invoices.col.patient"),
      cell: ({ row }) => {
        const p = row.original.payment?.booking?.patient
        return (
          <span className="text-sm text-foreground">
            {p ? `${p.firstName} ${p.lastName}` : "\u2014"}
          </span>
        )
      },
    },
    {
      accessorKey: "totalAmount",
      header: t("invoices.col.total"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {(row.original.totalAmount / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "taxAmount",
      header: t("invoices.col.vat"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {(row.original.taxAmount / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "zatcaStatus",
      header: t("invoices.col.zatca"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={zatcaStyles[row.original.zatcaStatus] ?? ""}
        >
          {row.original.zatcaStatus}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("invoices.col.date"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ]

  if (callbacks) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const invoice = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">{t("invoices.col.actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => callbacks.onView(invoice)}>
                <HugeiconsIcon icon={ViewIcon} size={14} />
                {t("invoices.col.viewDetails")}
              </DropdownMenuItem>
              {!invoice.sentAt && (
                <DropdownMenuItem onClick={() => callbacks.onSend(invoice)}>
                  <HugeiconsIcon icon={SentIcon} size={14} />
                  {t("invoices.col.sendInvoice")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return columns
}
