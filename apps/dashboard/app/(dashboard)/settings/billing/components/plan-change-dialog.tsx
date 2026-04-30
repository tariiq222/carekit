"use client"

import { useMemo, useState } from "react"
import { Button } from "@deqah/ui"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { getLocalizedPlanName } from "@/lib/billing/utils"
import { cn } from "@/lib/utils"
import type { BillingCycle, Plan } from "@/lib/types/billing"

interface PlanChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plans: Plan[]
  currentPlanId: string
  currentPlanSortOrder: number
  currentCycle: BillingCycle
  pending: boolean
  onSubmit: (payload: { planId: string; billingCycle: BillingCycle; isDowngrade: boolean }) => Promise<void>
}

export function PlanChangeDialog(props: PlanChangeDialogProps) {
  const {
    open,
    onOpenChange,
    plans,
    currentPlanId,
    currentPlanSortOrder,
    currentCycle,
    pending,
    onSubmit,
  } = props
  const { t, locale } = useLocale()
  const [selectedPlanId, setSelectedPlanId] = useState(
    plans.find((plan) => plan.id !== currentPlanId)?.id ?? "",
  )
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(currentCycle)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  async function handleSubmit() {
    if (!selectedPlan) return

    await onSubmit({
      planId: selectedPlan.id,
      billingCycle,
      isDowngrade: selectedPlan.sortOrder < currentPlanSortOrder,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("billing.plan.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("billing.plan.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="flex gap-2">
            <Button
              variant={billingCycle === "MONTHLY" ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle("MONTHLY")}
            >
              {t("billing.plan.monthly")}
            </Button>
            <Button
              variant={billingCycle === "ANNUAL" ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle("ANNUAL")}
            >
              {t("billing.plan.annual")}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId
              const isSelected = plan.id === selectedPlanId
              const price = billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly

              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-start transition-colors",
                    isCurrent
                      ? "cursor-not-allowed border-border bg-muted/50"
                      : isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">
                      {getLocalizedPlanName(plan, locale)}
                    </p>
                    {isCurrent && (
                      <span className="text-xs text-muted-foreground">
                        {t("billing.plan.current")}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("billing.plan.targetPrice")}: {plan.currency} {price}
                  </p>
                </button>
              )
            })}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("billing.actions.back")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!selectedPlan || pending}>
            {pending ? t("billing.actions.submitting") : t("billing.actions.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
