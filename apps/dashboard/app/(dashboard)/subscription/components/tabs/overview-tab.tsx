"use client"

import { useRouter } from "next/navigation"
import { useBilling } from "@/lib/billing/billing-context"
import { usePlans } from "@/hooks/use-current-subscription"
import { LimitReachedDialog } from "@/components/features/billing/limit-reached-dialog"
import { BillingOverviewStats } from "../billing-overview-stats"
import { CurrentPlanCard } from "../current-plan-card"
import { UsageBars } from "../usage-bars"

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
      <UsageBars />
      <LimitReachedDialog
        subscription={subscription}
        onUpgrade={() => {
          router.replace("/subscription?tab=plans", { scroll: false })
        }}
      />
    </div>
  )
}
