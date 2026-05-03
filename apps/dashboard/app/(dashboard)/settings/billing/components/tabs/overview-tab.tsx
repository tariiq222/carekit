"use client"

import { useRouter } from "next/navigation"
import { useBilling } from "@/lib/billing/billing-context"
import { usePlans } from "@/hooks/use-current-subscription"
import { LimitReachedDialog } from "@/components/features/billing/limit-reached-dialog"
import { BillingOverviewStats } from "../billing-overview-stats"
import { CurrentPlanCard } from "../current-plan-card"
import { UsageBars } from "../usage-bars"
import { InvoicesTable } from "../invoices-table"

export function OverviewTab() {
  const { subscription, isLoading } = useBilling()
  const { data: plans } = usePlans()
  const router = useRouter()

  return (
    <div className="space-y-4">
      <BillingOverviewStats subscription={subscription} isLoading={isLoading} />
      <CurrentPlanCard
        subscription={subscription}
        plans={plans}
        isLoading={isLoading}
      />
      <UsageBars subscription={subscription} isLoading={isLoading} />
      <InvoicesTable invoices={subscription?.invoices?.slice(0, 5)} isLoading={isLoading} />
      <LimitReachedDialog
        subscription={subscription}
        onUpgrade={() => {
          router.replace("/settings/billing?tab=plans", { scroll: false })
        }}
      />
    </div>
  )
}
