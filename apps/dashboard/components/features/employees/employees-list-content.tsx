"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Stethoscope02Icon,
  UserCheck01Icon,
  UserBlock01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"

import { ErrorBanner } from "@/components/features/error-banner"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { getEmployeeColumns } from "@/components/features/employees/employee-columns"
import { DeleteEmployeeDialog } from "@/components/features/employees/delete-employee-dialog"
import { useLocale } from "@/components/locale-provider"
import type { Employee } from "@/lib/types/employee"

interface EmployeesListContentProps {
  employees: Employee[]
  meta: { total: number } | null
  isLoading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  isActive: boolean | undefined
  setIsActive: (v: boolean | undefined) => void
  hasFilters: boolean
  resetFilters: () => void
}

export function EmployeesListContent({
  employees,
  meta,
  isLoading,
  error,
  search,
  setSearch,
  isActive,
  setIsActive,
  hasFilters,
  resetFilters,
}: EmployeesListContentProps) {
  const router = useRouter()
  const { t, locale } = useLocale()

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const handleEdit = (p: Employee) => router.push(`/employees/${p.id}/edit`)
  const handleDelete = (p: Employee) => setDeleteTarget(p)
  const handlePreview = (p: Employee) => router.push(`/employees/${p.id}`)

  const activeCount = useMemo(() => employees.filter((p) => p.isActive).length, [employees])
  const inactiveCount = useMemo(() => employees.filter((p) => !p.isActive).length, [employees])
  const avgRating = useMemo(() => {
    const rated = employees.filter((p) => p.averageRating != null)
    if (rated.length === 0) return null
    return (rated.reduce((sum, p) => sum + (p.averageRating ?? 0), 0) / rated.length).toFixed(1)
  }, [employees])

  const statusFilter = isActive === true ? "active" : isActive === false ? "inactive" : "all"
  const handleStatusChange = (v: string) => {
    if (v === "active") setIsActive(true)
    else if (v === "inactive") setIsActive(false)
    else setIsActive(undefined)
  }

  const hasActiveFilters = hasFilters || search.length > 0
  const handleReset = () => { resetFilters(); setSearch("") }

  const columns = getEmployeeColumns(handleEdit, locale, handleEdit, handleDelete, t, handlePreview)

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      {isLoading && !meta ? (
        <StatsGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </StatsGrid>
      ) : (
        <StatsGrid>
          <StatCard
            title={t("employees.stats.total")}
            value={meta?.total ?? employees.length}
            icon={Stethoscope02Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("employees.stats.active")}
            value={activeCount}
            icon={UserCheck01Icon}
            iconColor="success"
          />
          <StatCard
            title={t("employees.card.inactive")}
            value={inactiveCount}
            icon={UserBlock01Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("employees.stats.avgRating")}
            value={avgRating ?? "—"}
            icon={StarIcon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("employees.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: statusFilter,
            placeholder: t("employees.filters.status"),
            options: [
              { value: "all", label: t("employees.filters.allStatuses") },
              { value: "active", label: t("employees.card.active") },
              { value: "inactive", label: t("employees.card.inactive") },
            ],
            onValueChange: handleStatusChange,
          },
        ]}
        hasFilters={hasActiveFilters}
        onReset={handleReset}
        resultCount={meta && !isLoading ? `${meta.total} ${t("employees.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      {isLoading && employees.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          emptyTitle={t("employees.empty.title")}
          emptyDescription={t("employees.empty.description")}
        />
      )}

      <DeleteEmployeeDialog
        employee={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    </div>
  )
}
