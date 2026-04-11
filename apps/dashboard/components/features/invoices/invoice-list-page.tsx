"use client"

import { useState, useCallback } from "react"
import { Invoice02Icon, CheckmarkCircle02Icon, Cancel01Icon, TimeQuarterPassIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { getInvoiceColumns } from "@/components/features/invoices/invoice-columns"
import { InvoiceDetailSheet } from "@/components/features/invoices/invoice-detail-sheet"
import { FilterBar } from "@/components/features/filter-bar"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Skeleton } from "@/components/ui/skeleton"
import { useInvoices, useInvoiceStats, useInvoiceMutations } from "@/hooks/use-invoices"
import { useLocale } from "@/components/locale-provider"
import type { Invoice } from "@/lib/types/invoice"

export function InvoiceListPage() {
  const { t, locale } = useLocale()
  const { invoices, isLoading, error, search, setSearch, zatcaStatus, setZatcaStatus, hasFilters, resetFilters, refetch } = useInvoices()
  const { data: stats, isLoading: statsLoading } = useInvoiceStats()
  const { sendMut } = useInvoiceMutations()

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleView = useCallback((invoice: Invoice) => { setSelectedInvoiceId(invoice.id); setSheetOpen(true) }, [])
  const handleAction = useCallback(() => { refetch(); setSheetOpen(false) }, [refetch])
  const handleSend = useCallback(async (invoice: Invoice) => {
    try {
      await sendMut.mutateAsync(invoice.id)
      toast.success(t("invoices.sentSuccess"))
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoices.sentError"))
    }
  }, [sendMut, refetch, t])

  const columns = getInvoiceColumns({ onView: handleView, onSend: handleSend }, t)

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
      />

      <div className="flex flex-col gap-6">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : stats ? (
          <StatsGrid>
            <StatCard title={t("invoices.stats.total")} value={stats.total ?? 0} description={<FormattedCurrency amount={stats.totalAmount ?? 0} locale={locale} />} icon={Invoice02Icon} iconColor="primary" />
            <StatCard title={t("invoices.stats.accepted")} value={stats.accepted ?? 0} icon={CheckmarkCircle02Icon} iconColor="success" />
            <StatCard title={t("invoices.stats.pending")} value={stats.pending ?? 0} icon={TimeQuarterPassIcon} iconColor="warning" />
            <StatCard title={t("invoices.stats.rejected")} value={stats.rejected ?? 0} icon={Cancel01Icon} iconColor="warning" />
          </StatsGrid>
        ) : null}

        <FilterBar
          search={{ value: search, onChange: setSearch, placeholder: t("invoices.searchPlaceholder") }}
          selects={[{ key: "zatcaStatus", value: zatcaStatus, placeholder: t("invoices.filters.zatcaStatus"), options: [{ value: "all", label: t("invoices.filters.allStatuses") }, { value: "pending", label: t("invoices.filters.pending") }, { value: "submitted", label: t("invoices.filters.submitted") }, { value: "accepted", label: t("invoices.filters.accepted") }, { value: "rejected", label: t("invoices.filters.rejected") }], onValueChange: (v) => setZatcaStatus(v as typeof zatcaStatus) }]}
          hasFilters={hasFilters}
          onReset={resetFilters}
        />

        {error && <ErrorBanner message={error} />}

        {isLoading && invoices.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : (
          <DataTable columns={columns} data={invoices} emptyTitle={t("invoices.empty.title")} emptyDescription={t("invoices.empty.description")} />
        )}
      </div>

      <InvoiceDetailSheet invoiceId={selectedInvoiceId} open={sheetOpen} onOpenChange={setSheetOpen} onAction={handleAction} />
    </ListPageShell>
  )
}
