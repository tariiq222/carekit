"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { BillingStatusBanner } from "@/components/features/billing/status-banner"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { usePlans } from "@/hooks/use-current-subscription"
import { CurrentPlanCard } from "./components/current-plan-card"
import { UsageBars } from "./components/usage-bars"
import { InvoicesTable } from "./components/invoices-table"

export default function BillingPage() {
  const { t } = useLocale()
  const { subscription, isLoading } = useBilling()
  const { data: plans } = usePlans()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
      />

      <div className="space-y-4">
        <BillingStatusBanner />
        <CurrentPlanCard
          subscription={subscription}
          plans={plans}
          isLoading={isLoading}
        />
        <UsageBars subscription={subscription} isLoading={isLoading} />
        <InvoicesTable invoices={subscription?.invoices} isLoading={isLoading} />
      </div>
    </ListPageShell>
  )
}
