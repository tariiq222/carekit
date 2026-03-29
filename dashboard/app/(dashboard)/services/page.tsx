"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { useLocale } from "@/components/locale-provider"

export default function ServicesPage() {
  const { t } = useLocale()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("services")
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)

  const isServices = activeTab === "services"

  const handleAddClick = () => {
    if (isServices) {
      router.push("/services/create")
    } else {
      setCreateCategoryOpen(true)
    }
  }

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.title")}
        description={t("services.description")}
      >
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
        <Button
          className="gap-2 rounded-full px-5"
          onClick={handleAddClick}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {isServices ? t("services.addService") : t("services.categories.addCategory")}
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="services">{t("services.tabs.services")}</TabsTrigger>
          <TabsTrigger value="categories">{t("services.tabs.categories")}</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="flex flex-col gap-6 pt-4">
          <ServicesTabContent />
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-6 pt-4">
          <CategoriesTabContent />
        </TabsContent>
      </Tabs>

      <CreateCategoryDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen} />
    </ListPageShell>
  )
}
