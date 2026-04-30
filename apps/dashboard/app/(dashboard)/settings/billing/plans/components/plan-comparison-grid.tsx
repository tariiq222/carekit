"use client"

import { Badge, Button, Card } from "@carekit/ui"
import { getLocalizedPlanName } from "@/lib/billing/utils"
import { cn } from "@/lib/utils"
import type { BillingCycle, Plan } from "@/lib/types/billing"

interface PlanComparisonGridProps {
  plans: Plan[]
  currentPlanId?: string
  selectedPlanId: string
  billingCycle: BillingCycle
  locale: "ar" | "en"
  t: (key: string) => string
  onSelect: (planId: string) => void
}

export function PlanComparisonGrid({
  plans,
  currentPlanId,
  selectedPlanId,
  billingCycle,
  locale,
  t,
  onSelect,
}: PlanComparisonGridProps) {
  const recommendedPlan = plans[Math.min(1, plans.length - 1)]?.id

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId
        const isSelected = plan.id === selectedPlanId
        const price = billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly

        return (
          <Card
            key={plan.id}
            className={cn(
              "flex min-h-56 flex-col justify-between gap-5 p-5 transition-colors",
              isSelected ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {getLocalizedPlanName(plan, locale)}
                </h2>
                {isCurrent && <Badge variant="outline">{t("billing.plan.current")}</Badge>}
                {!isCurrent && plan.id === recommendedPlan && (
                  <Badge variant="outline">{t("billing.plan.recommended")}</Badge>
                )}
              </div>

              <div>
                <p className="text-3xl font-semibold text-foreground">{price}</p>
                <p className="text-sm text-muted-foreground">{plan.currency}</p>
              </div>
            </div>

            <Button
              type="button"
              variant={isSelected ? "default" : "outline"}
              disabled={isCurrent}
              onClick={() => onSelect(plan.id)}
            >
              {isCurrent ? t("billing.plan.current") : getLocalizedPlanName(plan, locale)}
            </Button>
          </Card>
        )
      })}
    </div>
  )
}
