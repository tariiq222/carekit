"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { getClientColumns } from "@/components/features/clients/client-columns"
import { DeleteClientDialog } from "@/components/features/clients/delete-client-dialog"
import { Button } from "@/components/ui/button"
import { useClients, useClientMutations } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"
import type { Client } from "@/lib/types/client"

export function ClientListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { clients, meta, isLoading, error, search, setSearch, isActive, setIsActive, resetSearch } = useClients()
  const { toggleActiveMut } = useClientMutations()

  const [pendingDelete, setPendingDelete] = useState<Client | null>(null)

  const hasFilters = isActive !== undefined || search.length > 0

  const columns = getClientColumns({
    onRowClick: (p) => router.push(`/clients/${p.id}`),
    onViewClick: (p) => router.push(`/clients/${p.id}`),
    onEditClick: (p) => router.push(`/clients/${p.id}/edit`),
    onToggleActive: (p) => {
      toggleActiveMut.mutate(
        { id: p.id, isActive: !p.isActive },
        {
          onSuccess: () =>
            toast.success(p.isActive ? t("clients.deactivated") : t("clients.activated")),
          onError: () =>
            toast.error(p.isActive ? t("clients.deactivateError") : t("clients.activateError")),
        },
      )
    },
    onDeleteClick: (p) => setPendingDelete(p),
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
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/clients/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("clients.addClient")}
        </Button>
      </PageHeader>

      {error && <ErrorBanner message={error} />}

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
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
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

      <DeleteClientDialog
        client={pendingDelete}
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
      />
    </ListPageShell>
  )
}
