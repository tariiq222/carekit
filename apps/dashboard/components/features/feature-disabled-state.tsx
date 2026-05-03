"use client"

import { useRouter } from "next/navigation"
import { LockIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { EmptyState } from "@/components/features/empty-state"
import { useLocale } from "@/components/locale-provider"

interface FeatureDisabledStateProps {
  title: string
  description: string
}

export function FeatureDisabledState({
  title,
  description,
}: FeatureDisabledStateProps) {
  const { t } = useLocale()
  const router = useRouter()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={LockIcon}
        iconColor="warning"
        title={t("featureGate.locked.title")}
        description={t("featureGate.locked.description")}
        action={{
          label: t("featureGate.locked.upgrade"),
          onClick: () => router.push("/subscription"),
        }}
      />
    </ListPageShell>
  )
}
