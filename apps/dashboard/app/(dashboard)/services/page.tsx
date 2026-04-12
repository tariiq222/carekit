"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ServicesTabContent } from "@/components/features/services/services-tab-content"
import { CategoriesTabContent } from "@/components/features/services/categories-tab-content"
import { CreateCategoryDialog } from "@/components/features/services/create-category-dialog"
import { DepartmentsTabContent } from "@/components/features/departments/departments-tab-content"
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

  const handleAddClick = () => {
    if (activeTab === "services") router.push("/services/create")
    else if (activeTab === "categories") setCreateCategoryOpen(true)
    else if (activeTab === "departments") setCreateDepartmentOpen(true)
  }

  const addLabel = () => {
    if (activeTab === "services") return t("services.addService")
    if (activeTab === "categories") return t("services.categories.addCategory")
    if (activeTab === "departments") return t("departments.addDepartment")
    return t("common.add")
  }

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.title")}
        description={t("services.description")}
      >
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
      </Tabs>

      <CreateCategoryDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen} />
    </ListPageShell>
  )
}
