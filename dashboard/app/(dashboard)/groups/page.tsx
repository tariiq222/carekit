"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ErrorBanner } from "@/components/features/error-banner"
import { GroupsListContent } from "@/components/features/groups/groups-list-content"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { useGroups } from "@/hooks/use-groups"
import { useLocale } from "@/components/locale-provider"
import { Add01Icon } from "@hugeicons/core-free-icons"

export default function GroupsPage() {
  const { t } = useLocale()
  const router = useRouter()
  const groupsState = useGroups()

  return (
    <ListPageShell>
      <Breadcrumbs items={[{ label: t("groups.title") }]} />

      <PageHeader
        title={t("groups.title")}
        description={t("groups.description")}
      >
        <Button asChild size="sm" className="gap-2 rounded-full px-5">
          <Link href="/groups/create">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("groups.addGroup")}
          </Link>
        </Button>
      </PageHeader>

      {groupsState.error && <ErrorBanner message={groupsState.error} />}

      <GroupsListContent
        {...groupsState}
        onGroupClick={(id) => router.push(`/groups/${id}`)}
      />
    </ListPageShell>
  )
}
