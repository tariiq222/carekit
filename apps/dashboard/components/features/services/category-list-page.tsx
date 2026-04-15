"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { getCategoryColumns } from "./category-columns"
import { CreateCategoryDialog } from "./create-category-dialog"
import { EditCategoryDialog } from "./edit-category-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

import { useCategories } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

export function CategoryListPage() {
  const { t, locale } = useLocale()
  const { data: categories, isLoading, error } = useCategories()

  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null)

  const columns = getCategoryColumns(locale, setEditTarget, setDeleteTarget, t)

  const filtered = (categories ?? []).filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nameEn.toLowerCase().includes(q) || c.nameAr.includes(q)
  })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.categories.title")}
        description={t("services.categories.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("services.categories.addCategory")}
        </Button>
      </PageHeader>

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
          emptyAction={{ label: t("services.categories.addCategory"), onClick: () => setCreateOpen(true) }}
        />
      )}

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
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
    </ListPageShell>
  )
}
