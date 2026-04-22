"use client"

// SaaS Plan 04 — Billing & Subscription page (skeleton; full polish in Plan 06)

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useCurrentSubscription, usePlans } from "@/hooks/use-current-subscription"

import { CurrentPlanCard } from "./components/current-plan-card"
import { UsageBars } from "./components/usage-bars"
import { InvoicesTable } from "./components/invoices-table"

export default function BillingPage() {
  const { locale } = useLocale()
  const isAr = locale === "ar"

  const { data: subscription, isLoading } = useCurrentSubscription()
  const { data: plans } = usePlans()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={isAr ? "الفوترة والاشتراك" : "Billing & Subscription"}
        description={
          isAr
            ? "إدارة خطة اشتراكك وفواتيرك."
            : "Manage your subscription plan and invoices."
        }
      />

      <div className="space-y-4">
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
