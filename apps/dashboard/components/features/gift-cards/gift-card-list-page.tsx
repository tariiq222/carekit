"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Coupon01Icon, CheckmarkCircle02Icon, Cancel01Icon, MoneyBag02Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { getGiftCardColumns } from "@/components/features/gift-cards/gift-card-columns"
import { GiftCardDetailSheet } from "@/components/features/gift-cards/gift-card-detail-sheet"
import { DeactivateGiftCardDialog } from "@/components/features/gift-cards/deactivate-gift-card-dialog"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterBar } from "@/components/features/filter-bar"
import { useGiftCards } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"
import type { GiftCard } from "@/lib/types/gift-card"

export function GiftCardListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { giftCards, meta, isLoading, error, search, setSearch, status, setStatus, page, setPage } = useGiftCards()

  const [viewTarget, setViewTarget] = useState<GiftCard | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<GiftCard | null>(null)

  const now = new Date()
  const activeCount = giftCards.filter((c) => c.isActive && c.balance > 0 && (!c.expiresAt || new Date(c.expiresAt) > now)).length
  const expiredCount = giftCards.filter((c) => c.expiresAt && new Date(c.expiresAt) < now).length
  const totalBalance = giftCards.reduce((sum, c) => sum + c.balance, 0)

  const columns = getGiftCardColumns(locale, (c) => setViewTarget(c), (c) => setViewTarget(c), (c) => setDeactivateTarget(c), t)

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("giftCards.title")}
        description={t("giftCards.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/gift-cards/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("giftCards.addCard")}
        </Button>
      </PageHeader>

      {isLoading && !meta ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid>
          <StatCard title={t("giftCards.stats.total")} value={meta?.total ?? 0} icon={Coupon01Icon} iconColor="primary" />
          <StatCard title={t("giftCards.stats.totalBalance")} value={<FormattedCurrency amount={totalBalance} locale={locale} decimals={2} />} icon={MoneyBag02Icon} iconColor="accent" />
          <StatCard title={t("giftCards.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("giftCards.stats.expired")} value={expiredCount} icon={Cancel01Icon} iconColor="warning" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("giftCards.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: status ?? "all",
            placeholder: t("giftCards.filters.allStatuses"),
            options: [
              { value: "all", label: t("giftCards.filters.allStatuses") },
              { value: "active", label: t("giftCards.status.active") },
              { value: "inactive", label: t("giftCards.status.inactive") },
              { value: "expired", label: t("giftCards.status.expired") },
              { value: "depleted", label: t("giftCards.status.depleted") },
            ],
            onValueChange: (v) => { setStatus(v === "all" ? undefined : v); setPage(1) },
          },
        ]}
        hasFilters={search.length > 0 || !!status}
        onReset={() => { setSearch(""); setStatus(undefined); setPage(1) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("giftCards.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {isLoading && giftCards.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable columns={columns} data={giftCards} emptyTitle={t("giftCards.empty.title")} emptyDescription={t("giftCards.empty.description")} />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">{page} / {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("table.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>{t("table.next")}</Button>
          </div>
        </div>
      )}

      <GiftCardDetailSheet giftCard={viewTarget} open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null) }} />
      <DeactivateGiftCardDialog giftCard={deactivateTarget} open={!!deactivateTarget} onOpenChange={(o) => { if (!o) setDeactivateTarget(null) }} />
    </ListPageShell>
  )
}
