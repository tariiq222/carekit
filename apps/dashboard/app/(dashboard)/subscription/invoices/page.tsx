"use client"

import { useMemo, useState } from "react"
import {
  CheckmarkCircle02Icon,
  DocumentValidationIcon,
  Invoice03Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { FilterBar } from "@/components/features/filter-bar"
import { EmptyState } from "@/components/features/empty-state"
import { useLocale } from "@/components/locale-provider"
import { useBillingInvoices } from "@/hooks/use-billing-invoices"
import type { InvoiceStatus } from "@/lib/types/billing"
import { InvoicesTable } from "./components/invoices-table"

const STATUS_VALUES: InvoiceStatus[] = ["DRAFT", "DUE", "PAID", "FAILED", "VOID"]

export default function BillingInvoicesPage() {
  const { t } = useLocale()
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL")
  const filters = useMemo(
    () => (status === "ALL" ? {} : { status }),
    [status],
  )
  const { data, isLoading } = useBillingInvoices(filters)

  const items = data?.items ?? []
  const total = items.length
  const paid = items.filter(i => i.status === "PAID").length
  const due = items.filter(i => i.status === "DUE").length
  const currentYear = new Date().getUTCFullYear()
  const thisYear = items.filter(i => {
    const d = i.issuedAt ?? i.periodStart
    return new Date(d).getUTCFullYear() === currentYear
  }).length

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.invoices.page.title")}
        description={t("billing.invoices.page.description")}
      />

      <StatsGrid>
        <StatCard
          title={t("billing.invoices.stats.total")}
          value={total}
          icon={Invoice03Icon}
          iconColor="primary"
        />
        <StatCard
          title={t("billing.invoices.stats.paid")}
          value={paid}
          icon={CheckmarkCircle02Icon}
          iconColor="success"
        />
        <StatCard
          title={t("billing.invoices.stats.due")}
          value={due}
          icon={DocumentValidationIcon}
          iconColor="warning"
        />
        <StatCard
          title={t("billing.invoices.stats.year")}
          value={thisYear}
          icon={Calendar03Icon}
          iconColor="accent"
        />
      </StatsGrid>

      <FilterBar
        selects={[
          {
            key: "status",
            value: status,
            placeholder: t("billing.invoices.filter.status"),
            options: [
              { value: "ALL", label: t("billing.invoices.filter.all") },
              ...STATUS_VALUES.map(v => ({
                value: v,
                label: t(`billing.invoices.status.${v.toLowerCase()}`),
              })),
            ],
            onValueChange: v => setStatus(v as InvoiceStatus | "ALL"),
          },
        ]}
        hasFilters={status !== "ALL"}
        onReset={() => setStatus("ALL")}
      />

      {!isLoading && items.length === 0 ? (
        <EmptyState
          title={t("billing.invoices.empty.title")}
          description={t("billing.invoices.empty.description")}
        />
      ) : (
        <InvoicesTable invoices={items} isLoading={isLoading} />
      )}
    </ListPageShell>
  )
}
