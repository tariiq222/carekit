"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { AllRatingsTab } from "@/components/features/practitioners/all-ratings-tab"
import { usePractitioners } from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"

export default function RatingsPage() {
  const { t } = useLocale()
  const { practitioners } = usePractitioners()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("practitioners.ratings.title")}
        description={t("practitioners.ratings.description")}
      />
      <AllRatingsTab practitioners={practitioners} />
    </ListPageShell>
  )
}
