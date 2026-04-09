"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { SessionsListContent } from "@/components/features/group-sessions/sessions-list-content"
import { CreateSessionDialog } from "@/components/features/group-sessions/create-session-dialog"
import { useLocale } from "@/components/locale-provider"

export default function GroupSessionsPage() {
  const { t } = useLocale()
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
          {t("groupSessions.addSession")}
        </Button>
      </PageHeader>

      <SessionsListContent />

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ListPageShell>
  )
}
