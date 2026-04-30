"use client"

import { Card, Skeleton } from "@deqah/ui"
import { ChartBarLineIcon } from "@hugeicons/core-free-icons"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { EmptyState } from "@/components/features/empty-state"
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

      {isLoading ? (
        <Card className="space-y-5 p-6">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </Card>
      ) : !subscription ? (
        <EmptyState
          title={t("billing.empty.subscription")}
          description={t("billing.usage.page.description")}
          icon={ChartBarLineIcon}
          action={{
            label: t("billing.actions.upgrade"),
            onClick: () => { window.location.href = "/settings/billing/plans" },
          }}
        />
      ) : (
        <UsageBars subscription={subscription} isLoading={false} />
      )}
    </ListPageShell>
  )
}
