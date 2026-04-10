"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Download04Icon, GridIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { exportServicesCsv, exportServicesExcel } from "@/lib/api/services"
import { ServicesTabContent } from "@/components/features/services/services-tab-content"
import { CategoriesTabContent } from "@/components/features/services/categories-tab-content"
import { CreateCategoryDialog } from "@/components/features/services/create-category-dialog"
import { DepartmentsTabContent } from "@/components/features/departments/departments-tab-content"
import { GroupsTabContent } from "@/components/features/groups/groups-tab-content"
import { fetchLicenseFeatures } from "@/lib/api/license"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"

export default function ServicesPage() {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") ?? "services"
  const [activeTab, setActiveTab] = useState(initialTab)
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false)

  const { data: licenseFeatures } = useQuery({
    queryKey: queryKeys.license.features(),
    queryFn: fetchLicenseFeatures,
    staleTime: 5 * 60_000,
  })

  void licenseFeatures // available for future feature flag checks

  const handleAddClick = () => {
    if (activeTab === "services") router.push("/services/create")
    else if (activeTab === "categories") setCreateCategoryOpen(true)
    else if (activeTab === "departments") setCreateDepartmentOpen(true)
    else if (activeTab === "groups") router.push("/groups/create")
  }

  const addLabel = () => {
    if (activeTab === "services") return t("services.addService")
    if (activeTab === "categories") return t("services.categories.addCategory")
    if (activeTab === "departments") return t("departments.addDepartment")
    if (activeTab === "groups") return t("groups.addGroup")
    return t("common.add")
  }

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.title")}
        description={t("services.description")}
      >
        {activeTab === "services" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-full px-5">
                <HugeiconsIcon icon={Download04Icon} size={16} />
                {t("services.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportServicesCsv}>
                <HugeiconsIcon icon={Download04Icon} size={16} className="me-2 text-muted-foreground" />
                {t("services.exportCsv")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportServicesExcel}>
                <HugeiconsIcon icon={GridIcon} size={16} className="me-2 text-muted-foreground" />
                {t("services.exportExcel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button className="gap-2 rounded-full px-5" onClick={handleAddClick}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {addLabel()}
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="departments">{t("services.tabs.departments")}</TabsTrigger>
          <TabsTrigger value="categories">{t("services.tabs.categories")}</TabsTrigger>
          <TabsTrigger value="services">{t("services.tabs.services")}</TabsTrigger>
          <TabsTrigger value="groups">{t("services.tabs.groups")}</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="flex flex-col gap-6 pt-4">
          <ServicesTabContent />
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-6 pt-4">
          <CategoriesTabContent />
        </TabsContent>

        <TabsContent value="departments" className="flex flex-col gap-6 pt-4">
          <DepartmentsTabContent
            onAdd={() => setCreateDepartmentOpen(true)}
            createOpen={createDepartmentOpen}
            onCreateOpenChange={setCreateDepartmentOpen}
          />
        </TabsContent>

        <TabsContent value="groups" className="flex flex-col gap-6 pt-4">
          <GroupsTabContent />
        </TabsContent>
      </Tabs>

      <CreateCategoryDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen} />
    </ListPageShell>
  )
}
