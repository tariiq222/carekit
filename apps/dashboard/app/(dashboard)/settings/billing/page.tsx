"use client"

import { Card } from "@carekit/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { useCurrentSubscription, usePlans } from "@/hooks/use-current-subscription"
import { CurrentPlanCard } from "./components/current-plan-card"
import { UsageBars } from "./components/usage-bars"
import { InvoicesTable } from "./components/invoices-table"

function BillingStatusBanner() {
  const { t } = useLocale()
  const { status } = useBilling()

  if (status !== "PAST_DUE" && status !== "SUSPENDED" && status !== "CANCELED") {
    return null
  }

  const content =
    status === "PAST_DUE"
      ? {
          title: t("billing.banner.pastDue.title"),
          description: t("billing.banner.pastDue.description"),
          className: "border-warning/30 bg-warning/10 text-warning",
        }
      : status === "SUSPENDED"
        ? {
            title: t("billing.banner.suspended.title"),
            description: t("billing.banner.suspended.description"),
            className: "border-error/30 bg-error/10 text-error",
          }
        : {
            title: t("billing.banner.canceled.title"),
            description: t("billing.banner.canceled.description"),
            className: "border-border bg-muted text-foreground",
          }

  return (
    <Card className={`space-y-1 border p-4 ${content.className}`}>
      <p className="font-semibold">{content.title}</p>
      <p className="text-sm opacity-90">{content.description}</p>
    </Card>
  )
}

export default function BillingPage() {
  const { t } = useLocale()
  const { data: subscription, isLoading } = useCurrentSubscription()
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
