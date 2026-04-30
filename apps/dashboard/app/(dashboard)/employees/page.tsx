"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, StarIcon, UserGroupIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@deqah/ui"
import { EmployeesListContent } from "@/components/features/employees/employees-list-content"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { AttachExistingUserDialog } from "@/components/features/employees/attach-existing-user-dialog"
import { useEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useTerminology } from "@/hooks/use-terminology"

export default function EmployeesPage() {
  return <Suspense><EmployeesPageInner /></Suspense>
}

function EmployeesPageInner() {
  const router = useRouter()
  const { t } = useLocale()
  const { user } = useAuth()
  const [attachOpen, setAttachOpen] = useState(false)
  // "الأطباء"/"Doctors" (medical), "المصففون"/"Stylists" (salon),
  // "المدربون"/"Trainers" (fitness), "المستشارون"/"Consultants" (consulting).
  const { t: term } = useTerminology(user?.verticalSlug ?? undefined)
  const titleLabel = term("employee.plural", t("nav.employees"))

  const {
    employees,
    meta,
    isLoading,
    error,
    search,
    setSearch,
    isActive,
    setIsActive,
    sortBy,
    sortOrder,
    setSort,
    hasFilters,
    resetFilters,
  } = useEmployees()

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={titleLabel}
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
        <Button
          variant="outline"
          className="gap-2 rounded-full px-5"
          onClick={() => setAttachOpen(true)}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={16} />
          {t("employees.attach.button")}
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
        sortBy={sortBy}
        sortOrder={sortOrder}
        setSort={setSort}
        hasFilters={hasFilters}
        resetFilters={resetFilters}
      />

      <AttachExistingUserDialog open={attachOpen} onOpenChange={setAttachOpen} />
    </ListPageShell>
  )
}
