"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Download04Icon,
  GridIcon,
  UserMultiple02Icon,
  UserCheck01Icon,
  UserBlock01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { StatCard } from "@/components/features/stat-card"
import { StatsGrid } from "@/components/features/stats-grid"
import { FilterBar } from "@/components/features/filter-bar"
import { getClientColumns } from "@/components/features/clients/client-columns"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useClients, useClientMutations, useClientListStats } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"
import { exportClientsCsv, exportClientsExcel } from "@/lib/api/reports"
import type { Client } from "@/lib/types/client"

export function ClientListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { clients, meta, isLoading, error, search, setSearch, isActive, setIsActive, resetSearch } = useClients()
  const { activateMut, deactivateMut } = useClientMutations()
  const { data: listStats, isLoading: statsLoading } = useClientListStats()

  const [confirmClient, setConfirmClient] = useState<Client | null>(null)

  const hasFilters = isActive !== undefined || search.length > 0

  const handleConfirmToggle = () => {
    if (!confirmClient) return
    if (confirmClient.isActive) {
      deactivateMut.mutate(confirmClient.id, {
        onSuccess: () => toast.success(t("clients.deactivated")),
        onError: (err) => toast.error(err instanceof Error ? err.message : t("clients.deactivateError")),
      })
    } else {
      activateMut.mutate(confirmClient.id, {
        onSuccess: () => toast.success(t("clients.activated")),
        onError: (err) => toast.error(err instanceof Error ? err.message : t("clients.activateError")),
      })
    }
    setConfirmClient(null)
  }

  const columns = getClientColumns({
    onRowClick: (p) => router.push(`/clients/${p.id}`),
    onViewClick: (p) => router.push(`/clients/${p.id}`),
    onEditClick: (p) => router.push(`/clients/${p.id}/edit`),
    onToggleActive: setConfirmClient,
    t,
    locale,
  })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("clients.title")}
        description={t("clients.description")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <HugeiconsIcon icon={Download04Icon} size={16} />
              {t("clients.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportClientsCsv}>
              <HugeiconsIcon icon={Download04Icon} size={16} className="me-2 text-muted-foreground" />
              {t("clients.exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportClientsExcel}>
              <HugeiconsIcon icon={GridIcon} size={16} className="me-2 text-muted-foreground" />
              {t("clients.exportExcel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/clients/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("clients.addClient")}
        </Button>
      </PageHeader>

      {error && <ErrorBanner message={error} />}

      {/* Stats — server-side counts, not client-side page slice */}
      {statsLoading ? (
        <StatsGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </StatsGrid>
      ) : (
        <StatsGrid>
          <StatCard
            title={t("clients.stats.total")}
            value={listStats?.total ?? 0}
            description={t("clients.stats.allClients")}
            icon={UserMultiple02Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("clients.stats.active")}
            value={listStats?.active ?? 0}
            description={t("clients.stats.activeDesc")}
            icon={UserCheck01Icon}
            iconColor="success"
          />
          <StatCard
            title={t("clients.stats.inactive")}
            value={listStats?.inactive ?? 0}
            description={t("clients.stats.inactiveDesc")}
            icon={UserBlock01Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("clients.stats.newThisMonth")}
            value={listStats?.newThisMonth ?? 0}
            description={t("clients.stats.newDesc")}
            icon={UserAdd01Icon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("clients.searchPlaceholder") }}
        hasFilters={hasFilters}
        onReset={() => { resetSearch(); setIsActive(undefined) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("clients.stats.total")}` : undefined}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("clients.filter.allStatuses"),
            options: [
              { value: "all", label: t("clients.filter.allStatuses") },
              { value: "active", label: t("clients.status.active") },
              { value: "inactive", label: t("clients.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
      />

      {/* Table */}
      {isLoading && clients.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={clients}
          emptyTitle={t("clients.empty.title")}
          emptyDescription={t("clients.empty.description")}
          emptyAction={{ label: t("clients.addClient"), onClick: () => router.push("/clients/create") }}
        />
      )}

      <AlertDialog open={!!confirmClient} onOpenChange={(o) => !o && setConfirmClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmClient?.isActive ? t("clients.confirm.deactivateTitle") : t("clients.confirm.activateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmClient?.isActive ? t("clients.confirm.deactivateDesc") : t("clients.confirm.activateDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={confirmClient?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmClient?.isActive ? t("clients.actions.deactivate") : t("clients.actions.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListPageShell>
  )
}
