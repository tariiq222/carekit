"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Download04Icon, GridIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exportPractitionersCsv, exportPractitionersExcel } from "@/lib/api/reports"
import { AllRatingsTab } from "@/components/features/practitioners/all-ratings-tab"
import { PractitionersListContent } from "@/components/features/practitioners/practitioners-list-content"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { usePractitioners } from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"

export default function PractitionersPage() {
  return <Suspense><PractitionersPageInner /></Suspense>
}

function PractitionersPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") === "ratings" ? "ratings" : "list"
  const { t } = useLocale()

  const {
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
  } = usePractitioners()

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("practitioners.title")}
        description={t("practitioners.description")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <HugeiconsIcon icon={Download04Icon} size={16} />
              {t("practitioners.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportPractitionersCsv}>
              <HugeiconsIcon icon={Download04Icon} size={16} className="me-2 text-muted-foreground" />
              {t("practitioners.exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPractitionersExcel}>
              <HugeiconsIcon icon={GridIcon} size={16} className="me-2 text-muted-foreground" />
              {t("practitioners.exportExcel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/practitioners/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("practitioners.addPractitioner")}
        </Button>
      </PageHeader>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="list">{t("practitioners.tabs.list")}</TabsTrigger>
          <TabsTrigger value="ratings">{t("practitioners.tabs.ratings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <PractitionersListContent
            practitioners={practitioners}
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
        </TabsContent>

        <TabsContent value="ratings" className="mt-6">
          <AllRatingsTab practitioners={practitioners} />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
