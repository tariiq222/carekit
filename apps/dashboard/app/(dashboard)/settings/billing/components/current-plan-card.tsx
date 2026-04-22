"use client"

import { useState } from "react"
import { Badge, Button, Card, Skeleton } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations } from "@/hooks/use-current-subscription"
import {
  formatBillingDate,
  getBillingCycleLabel,
  getLocalizedPlanName,
} from "@/lib/billing/utils"
import { cn } from "@/lib/utils"
import type { Plan, Subscription, SubscriptionStatus } from "@/lib/types/billing"
import { CancelSubscriptionDialog } from "./cancel-subscription-dialog"
import { PlanChangeDialog } from "./plan-change-dialog"

const statusClassNames: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  TRIALING: "border-primary/30 bg-primary/10 text-primary",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  SUSPENDED: "border-error/30 bg-error/10 text-error",
  CANCELED: "border-border bg-muted text-muted-foreground",
}

const statusKeyMap: Record<SubscriptionStatus, string> = {
  ACTIVE: "billing.status.active",
  TRIALING: "billing.status.trialing",
  PAST_DUE: "billing.status.pastDue",
  SUSPENDED: "billing.status.suspended",
  CANCELED: "billing.status.canceled",
}

interface CurrentPlanCardProps {
  subscription?: Subscription | null
  plans?: Plan[]
  isLoading: boolean
}

export function CurrentPlanCard({
  subscription,
  plans = [],
  isLoading,
}: CurrentPlanCardProps) {
  const { t, locale } = useLocale()
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const { upgradeMut, downgradeMut, cancelMut, resumeMut, startMut } = useBillingMutations()

  const currentPlanId = subscription?.plan.id ?? ""

  if (isLoading) {
    return (
      <Card className="space-y-4 p-6">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t("billing.empty.subscription")}</p>
      </Card>
    )
  }

  const currentSubscription = subscription
  const pending =
    upgradeMut.isPending ||
    downgradeMut.isPending ||
    cancelMut.isPending ||
    resumeMut.isPending ||
    startMut.isPending

  const statusKey = statusKeyMap[currentSubscription.status]
  const planName = getLocalizedPlanName(currentSubscription.plan, locale)
  const nextBilling = formatBillingDate(currentSubscription.currentPeriodEnd, locale)
  const trialEndsAt = currentSubscription.trialEndsAt
    ? formatBillingDate(currentSubscription.trialEndsAt, locale)
    : null

  async function submitPlanChange(payload: {
    planId: string
    billingCycle: Subscription["billingCycle"]
    isDowngrade: boolean
  }) {
    if (currentSubscription.status === "CANCELED") {
      await startMut.mutateAsync(payload)
    } else if (payload.isDowngrade) {
      await downgradeMut.mutateAsync(payload)
    } else {
      await upgradeMut.mutateAsync(payload)
    }

    setPlanDialogOpen(false)
  }

  async function submitCancellation(reason?: string) {
    await cancelMut.mutateAsync(reason)
  }

  return (
    <>
      <Card className="space-y-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{planName}</h2>
              <Badge
                variant="outline"
                className={cn("font-medium", statusClassNames[subscription.status])}
              >
                {t(statusKey)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("billing.summary.nextBilling")}:{" "}
              <span className="font-medium text-foreground">{nextBilling}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("billing.summary.currentCycle")}:{" "}
              <span className="font-medium text-foreground">
                {getBillingCycleLabel(currentSubscription.billingCycle, locale)}
              </span>
            </p>
            {trialEndsAt && (
              <p className="text-sm text-muted-foreground">
                {t("billing.summary.trialEnds")}:{" "}
                <span className="font-medium text-foreground">{trialEndsAt}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setPlanDialogOpen(true)}
              disabled={pending || plans.length === 0}
            >
              {t("billing.actions.changePlan")}
            </Button>
            {currentSubscription.status === "SUSPENDED" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => resumeMut.mutate()}
              >
                {resumeMut.isPending
                  ? t("billing.actions.resuming")
                  : t("billing.actions.resume")}
              </Button>
            )}
            {currentSubscription.status !== "CANCELED" && currentSubscription.status !== "SUSPENDED" && (
              <Button
                size="sm"
                variant="outline"
                className="text-error hover:text-error"
                disabled={pending}
                onClick={() => setCancelDialogOpen(true)}
              >
                {cancelMut.isPending
                  ? t("billing.actions.canceling")
                  : t("billing.actions.cancel")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {planDialogOpen && (
        <PlanChangeDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          plans={plans}
          currentPlanId={currentPlanId}
          currentPlanSortOrder={currentSubscription.plan.sortOrder}
          currentCycle={currentSubscription.billingCycle}
          pending={pending}
          onSubmit={submitPlanChange}
        />
      )}

      {cancelDialogOpen && (
        <CancelSubscriptionDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          pending={cancelMut.isPending}
          onConfirm={submitCancellation}
        />
      )}
    </>
  )
}
