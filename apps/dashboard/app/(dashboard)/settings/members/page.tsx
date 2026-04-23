"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { MembersTable } from "@/components/features/members/members-table"
import { InvitationsSection } from "@/components/features/members/invitations-section"
import { InviteMemberDialog } from "@/components/features/members/invite-member-dialog"

export default function MembersPage() {
  const { t } = useLocale()
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("nav.settings"), href: "/settings" },
          { label: t("settings.members.title") },
        ]}
      />
      <PageHeader
        title={t("settings.members.title")}
        description={t("settings.members.description")}
      >
        <Button size="sm" onClick={() => setShowInviteDialog(true)} className="gap-2">
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("members.invite.button")}
        </Button>
      </PageHeader>
      <div className="space-y-6">
        <MembersTable />
        <InvitationsSection />
      </div>

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </ListPageShell>
  )
}