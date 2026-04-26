"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@carekit/ui"
import { PrivacyPolicyForm } from "@/components/features/content/privacy-policy-form"
import { useLocale } from "@/components/locale-provider"
import { useSiteSettings } from "@/hooks/use-site-settings"

export default function ContentLegalPage() {
  const { t } = useLocale()
  const { data, isLoading } = useSiteSettings("legal.")
  const rows = data ?? []

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("content.legal.title")}
        description={t("content.legal.description")}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <PrivacyPolicyForm rows={rows} />
      )}
    </ListPageShell>
  )
}
