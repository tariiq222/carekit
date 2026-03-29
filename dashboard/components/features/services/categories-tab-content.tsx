"use client"

import { useState } from "react"

import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@/components/ui/skeleton"

import { getCategoryColumns } from "./category-columns"
import { EditCategoryDialog } from "./edit-category-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

import { useCategories } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

export function CategoriesTabContent() {
  const { t, locale } = useLocale()
  const { data: categories, isLoading, error } = useCategories()

  const [search, setSearch] = useState("")
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null)

  const columns = getCategoryColumns(locale, setEditTarget, setDeleteTarget, t)

  const filtered = (categories ?? []).filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nameEn.toLowerCase().includes(q) || c.nameAr.includes(q)
  })

  return (
    <>
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("services.categories.searchPlaceholder") }}
        hasFilters={search.length > 0}
        onReset={() => setSearch("")}
      />

      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle={t("services.categories.empty.title")}
          emptyDescription={t("services.categories.empty.description")}
        />
      )}

      <EditCategoryDialog
        category={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
      />
      <DeleteCategoryDialog
        category={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    </>
  )
}
