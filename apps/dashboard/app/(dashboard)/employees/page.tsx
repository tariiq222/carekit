"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, StarIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@/components/ui/button"
import { EmployeesListContent } from "@/components/features/employees/employees-list-content"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { useEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"

export default function EmployeesPage() {
  return <Suspense><EmployeesPageInner /></Suspense>
}

function EmployeesPageInner() {
  const router = useRouter()
  const { t } = useLocale()

  const {
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
  } = useEmployees()

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("employees.title")}
        description={t("employees.description")}
      >
        <Button
          variant="outline"
          className="gap-2 rounded-full px-5"
          onClick={() => router.push("/ratings")}
        >
          <HugeiconsIcon icon={StarIcon} size={16} />
          {t("employees.tabs.ratings")}
        </Button>
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/employees/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("employees.addEmployee")}
        </Button>
      </PageHeader>

      <EmployeesListContent
        employees={employees}
        meta={meta}
        isLoading={isLoading}
        error={error}
        search={search}
        setSearch={setSearch}
        isActive={isActive}
        setIsActive={setIsActive}
        hasFilters={hasFilters}
        resetFilters={resetFilters}
      />
    </ListPageShell>
  )
}
