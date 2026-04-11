"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"

import { useInvoiceMutations } from "@/hooks/use-invoices"
import { fetchInvoiceHtml } from "@/lib/api/invoices"
import { useLocale } from "@/components/locale-provider"
import type { Invoice } from "@/lib/types/invoice"

/* ─── Props ─── */

interface InvoiceActionsProps {
  invoice: Invoice
  onAction: () => void
}

/* ─── Component ─── */

export function InvoiceActions({ invoice, onAction }: InvoiceActionsProps) {
  const { t } = useLocale()
  const { sendMut } = useInvoiceMutations()
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [htmlOpen, setHtmlOpen] = useState(false)
  const [htmlLoading, setHtmlLoading] = useState(false)

  const canSend = !invoice.sentAt

  const handleSend = async () => {
    try {
      await sendMut.mutateAsync(invoice.id)
      toast.success(t("invoices.actions.sendSuccess"))
      onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoices.actions.sendError"))
    }
  }

  const handleViewHtml = async () => {
    setHtmlLoading(true)
    try {
      const html = await fetchInvoiceHtml(invoice.id)
      setHtmlContent(html)
      setHtmlOpen(true)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("invoices.actions.htmlError"),
      )
    } finally {
      setHtmlLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
        {canSend && (
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMut.isPending}
          >
            {sendMut.isPending ? t("invoices.actions.sending") : t("invoices.actions.send")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleViewHtml}
          disabled={htmlLoading}
        >
          {htmlLoading ? t("invoices.actions.loading") : t("invoices.actions.viewHtml")}
        </Button>
      </div>

      {/* HTML Preview Sheet */}
      <Sheet open={htmlOpen} onOpenChange={setHtmlOpen}>
        <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
          <SheetHeader>
            <SheetTitle>
              {invoice.invoiceNumber}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto rounded-lg border bg-card p-1">
            {htmlContent && (
              <iframe
                srcDoc={htmlContent}
                className="h-[60vh] w-full rounded border-0"
                title={invoice.invoiceNumber}
                sandbox="allow-same-origin"
              />
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setHtmlOpen(false)}>
              {t("invoices.detail.close")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
