"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { UsageBars } from "../components/usage-bars"
import { UsageStatsGrid } from "./components/usage-stats-grid"

export default function BillingUsagePage() {
  const { t } = useLocale()
  const { subscription, isLoading } = useBilling()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.usage.page.title")}
        description={t("billing.usage.page.description")}
      />

      <UsageStatsGrid subscription={subscription} isLoading={isLoading} />

      <UsageBars />
    </ListPageShell>
  )
}
