"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { OfferingsTabContent } from "@/components/features/group-sessions/offerings-tab-content"
import { SessionsTabContent } from "@/components/features/group-sessions/sessions-tab-content"
import { CreateOfferingDialog } from "@/components/features/group-sessions/create-offering-dialog"
import { useLocale } from "@/components/locale-provider"

export default function GroupSessionsPage() {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState("offerings")
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <ListPageShell>
      <Breadcrumbs items={[{ label: t("groupSessions.title") }]} />

      <PageHeader
        title={t("groupSessions.title")}
        description={t("groupSessions.description")}
      >
        <Button
          className="gap-2 rounded-full px-5"
          onClick={() => setCreateOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("groupSessions.addOffering")}
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="offerings">{t("groupSessions.tabs.offerings")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("groupSessions.tabs.sessions")}</TabsTrigger>
        </TabsList>

        <TabsContent value="offerings" className="flex flex-col gap-6 pt-4">
          <OfferingsTabContent />
        </TabsContent>

        <TabsContent value="sessions" className="flex flex-col gap-6 pt-4">
          <SessionsTabContent />
        </TabsContent>
      </Tabs>

      <CreateOfferingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ListPageShell>
  )
}
