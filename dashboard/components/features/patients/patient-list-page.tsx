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
import { getPatientColumns } from "@/components/features/patients/patient-columns"
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
import { usePatients, usePatientMutations, usePatientListStats } from "@/hooks/use-patients"
import { useLocale } from "@/components/locale-provider"
import { exportPatientsCsv, exportPatientsExcel } from "@/lib/api/reports"
import type { Patient } from "@/lib/types/patient"

export function PatientListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { patients, meta, isLoading, error, search, setSearch, isActive, setIsActive, resetSearch } = usePatients()
  const { activateMut, deactivateMut } = usePatientMutations()
  const { data: listStats, isLoading: statsLoading } = usePatientListStats()

  const [confirmPatient, setConfirmPatient] = useState<Patient | null>(null)

  const hasFilters = isActive !== undefined || search.length > 0

  const handleConfirmToggle = () => {
    if (!confirmPatient) return
    if (confirmPatient.isActive) {
      deactivateMut.mutate(confirmPatient.id, {
        onSuccess: () => toast.success(t("patients.deactivated")),
        onError: (err) => toast.error(err instanceof Error ? err.message : t("patients.deactivateError")),
      })
    } else {
      activateMut.mutate(confirmPatient.id, {
        onSuccess: () => toast.success(t("patients.activated")),
        onError: (err) => toast.error(err instanceof Error ? err.message : t("patients.activateError")),
      })
    }
    setConfirmPatient(null)
  }

  const columns = getPatientColumns({
    onRowClick: (p) => router.push(`/patients/${p.id}`),
    onViewClick: (p) => router.push(`/patients/${p.id}`),
    onEditClick: (p) => router.push(`/patients/${p.id}/edit`),
    onToggleActive: setConfirmPatient,
    t,
    locale,
  })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("patients.title")}
        description={t("patients.description")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <HugeiconsIcon icon={Download04Icon} size={16} />
              {t("patients.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportPatientsCsv}>
              <HugeiconsIcon icon={Download04Icon} size={16} className="me-2 text-muted-foreground" />
              {t("patients.exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPatientsExcel}>
              <HugeiconsIcon icon={GridIcon} size={16} className="me-2 text-muted-foreground" />
              {t("patients.exportExcel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/patients/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("patients.addPatient")}
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
            title={t("patients.stats.total")}
            value={listStats?.total ?? 0}
            description={t("patients.stats.allPatients")}
            icon={UserMultiple02Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("patients.stats.active")}
            value={listStats?.active ?? 0}
            description={t("patients.stats.activeDesc")}
            icon={UserCheck01Icon}
            iconColor="success"
          />
          <StatCard
            title={t("patients.stats.inactive")}
            value={listStats?.inactive ?? 0}
            description={t("patients.stats.inactiveDesc")}
            icon={UserBlock01Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("patients.stats.newThisMonth")}
            value={listStats?.newThisMonth ?? 0}
            description={t("patients.stats.newDesc")}
            icon={UserAdd01Icon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("patients.searchPlaceholder") }}
        hasFilters={hasFilters}
        onReset={() => { resetSearch(); setIsActive(undefined) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("patients.stats.total")}` : undefined}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("patients.filter.allStatuses"),
            options: [
              { value: "all", label: t("patients.filter.allStatuses") },
              { value: "active", label: t("patients.status.active") },
              { value: "inactive", label: t("patients.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
      />

      {/* Table */}
      {isLoading && patients.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={patients}
          emptyTitle={t("patients.empty.title")}
          emptyDescription={t("patients.empty.description")}
          emptyAction={{ label: t("patients.addPatient"), onClick: () => router.push("/patients/create") }}
        />
      )}

      <AlertDialog open={!!confirmPatient} onOpenChange={(o) => !o && setConfirmPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmPatient?.isActive ? t("patients.confirm.deactivateTitle") : t("patients.confirm.activateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPatient?.isActive ? t("patients.confirm.deactivateDesc") : t("patients.confirm.activateDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={confirmPatient?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmPatient?.isActive ? t("patients.actions.deactivate") : t("patients.actions.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListPageShell>
  )
}
