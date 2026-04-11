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
import { getPractitionerColumns } from "@/components/features/practitioners/practitioner-columns"
import { DeletePractitionerDialog } from "@/components/features/practitioners/delete-practitioner-dialog"
import { useLocale } from "@/components/locale-provider"
import type { Practitioner } from "@/lib/types/practitioner"

interface PractitionersListContentProps {
  practitioners: Practitioner[]
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

export function PractitionersListContent({
  practitioners,
  meta,
  isLoading,
  error,
  search,
  setSearch,
  isActive,
  setIsActive,
  hasFilters,
  resetFilters,
}: PractitionersListContentProps) {
  const router = useRouter()
  const { t, locale } = useLocale()

  const [deleteTarget, setDeleteTarget] = useState<Practitioner | null>(null)

  const handleEdit = (p: Practitioner) => router.push(`/practitioners/${p.id}/edit`)
  const handleDelete = (p: Practitioner) => setDeleteTarget(p)
  const handlePreview = (p: Practitioner) => router.push(`/practitioners/${p.id}`)

  const activeCount = useMemo(() => practitioners.filter((p) => p.isActive).length, [practitioners])
  const inactiveCount = useMemo(() => practitioners.filter((p) => !p.isActive).length, [practitioners])
  const avgRating = useMemo(() => {
    const rated = practitioners.filter((p) => p.averageRating != null)
    if (rated.length === 0) return null
    return (rated.reduce((sum, p) => sum + (p.averageRating ?? 0), 0) / rated.length).toFixed(1)
  }, [practitioners])

  const statusFilter = isActive === true ? "active" : isActive === false ? "inactive" : "all"
  const handleStatusChange = (v: string) => {
    if (v === "active") setIsActive(true)
    else if (v === "inactive") setIsActive(false)
    else setIsActive(undefined)
  }

  const hasActiveFilters = hasFilters || search.length > 0
  const handleReset = () => { resetFilters(); setSearch("") }

  const columns = getPractitionerColumns(handleEdit, locale, handleEdit, handleDelete, t, handlePreview)

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
            title={t("practitioners.stats.total")}
            value={meta?.total ?? practitioners.length}
            icon={Stethoscope02Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("practitioners.stats.active")}
            value={activeCount}
            icon={UserCheck01Icon}
            iconColor="success"
          />
          <StatCard
            title={t("practitioners.card.inactive")}
            value={inactiveCount}
            icon={UserBlock01Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("practitioners.stats.avgRating")}
            value={avgRating ?? "—"}
            icon={StarIcon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("practitioners.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: statusFilter,
            placeholder: t("practitioners.filters.status"),
            options: [
              { value: "all", label: t("practitioners.filters.allStatuses") },
              { value: "active", label: t("practitioners.card.active") },
              { value: "inactive", label: t("practitioners.card.inactive") },
            ],
            onValueChange: handleStatusChange,
          },
        ]}
        hasFilters={hasActiveFilters}
        onReset={handleReset}
        resultCount={meta && !isLoading ? `${meta.total} ${t("practitioners.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      {isLoading && practitioners.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={practitioners}
          emptyTitle={t("practitioners.empty.title")}
          emptyDescription={t("practitioners.empty.description")}
        />
      )}

      <DeletePractitionerDialog
        practitioner={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    </div>
  )
}
