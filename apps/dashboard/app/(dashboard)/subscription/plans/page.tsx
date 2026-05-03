"use client"

import { useMemo, useState } from "react"
import { Button, Card, Skeleton } from "@deqah/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import {
  useBillingMutations,
  usePlans,
  useProrationPreview,
} from "@/hooks/use-current-subscription"
import { formatBillingDate } from "@/lib/billing/utils"
import { cn } from "@/lib/utils"
import type { BillingCycle } from "@/lib/types/billing"
import { PlanComparisonGrid } from "./components/plan-comparison-grid"
import { FeatureMatrix } from "./components/feature-matrix"

export default function BillingPlansPage() {
  const { t, locale } = useLocale()
  const { subscription, isLoading: subscriptionLoading } = useBilling()
  const { data: plans = [], isLoading: plansLoading } = usePlans()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    subscription?.billingCycle ?? "MONTHLY",
  )
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const {
    upgradeMut,
    scheduleDowngradeMut,
    cancelScheduledDowngradeMut,
  } = useBillingMutations()

  const selectedPlan = useMemo(() => {
    const fallback = plans.find((plan) => plan.id !== subscription?.plan.id) ?? plans[0]
    return plans.find((plan) => plan.id === selectedPlanId) ?? fallback ?? null
  }, [plans, selectedPlanId, subscription?.plan.id])

  const previewInput = selectedPlan
    ? { planId: selectedPlan.id, billingCycle }
    : null
  const { data: preview, isLoading: previewLoading } = useProrationPreview(previewInput)
  const pending =
    upgradeMut.isPending ||
    scheduleDowngradeMut.isPending ||
    cancelScheduledDowngradeMut.isPending
  const currentPlanId = subscription?.plan.id
  const isCurrent = selectedPlan?.id === currentPlanId
  const actionLabel =
    preview?.action === "SCHEDULE_DOWNGRADE"
      ? t("billing.actions.downgrade")
      : t("billing.actions.upgrade")

  async function submitPlanChange() {
    if (!selectedPlan || isCurrent) return
    const dto = { planId: selectedPlan.id, billingCycle }
    if (preview?.action === "SCHEDULE_DOWNGRADE") {
      await scheduleDowngradeMut.mutateAsync(dto)
    } else {
      await upgradeMut.mutateAsync(dto)
    }
  }

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.plans.title")}
        description={t("billing.plans.description")}
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit rounded-lg border border-border bg-card p-1">
            {(["MONTHLY", "ANNUAL"] as const).map((cycle) => (
              <Button
                key={cycle}
                type="button"
                size="sm"
                variant={billingCycle === cycle ? "default" : "ghost"}
                onClick={() => setBillingCycle(cycle)}
              >
                {cycle === "MONTHLY"
                  ? t("billing.plan.monthly")
                  : t("billing.plan.annual")}
              </Button>
            ))}
          </div>

          {subscription?.scheduledPlanId && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => cancelScheduledDowngradeMut.mutateAsync()}
            >
              {t("billing.plans.cancelScheduled")}
            </Button>
          )}
        </div>

        {subscriptionLoading || plansLoading ? (
          <Card className="space-y-3 p-5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : (
          <>
            <PlanComparisonGrid
              plans={plans}
              currentPlanId={currentPlanId}
              selectedPlanId={selectedPlan?.id ?? ""}
              billingCycle={billingCycle}
              locale={locale}
              t={t}
              onSelect={setSelectedPlanId}
            />

            <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {previewText({
                    action: preview?.action,
                  amountSar: preview?.amountSar,
                  effectiveAt: preview?.effectiveAt,
                  trialChange: preview?.trialChange,
                  locale,
                  t,
                })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {"⃁"}
                </p>
              </div>

              <Button
                type="button"
                disabled={!selectedPlan || isCurrent || pending || previewLoading}
                onClick={() => void submitPlanChange()}
                className={cn(isCurrent && "opacity-70")}
              >
                {pending ? t("billing.actions.submitting") : actionLabel}
              </Button>
            </Card>

            <FeatureMatrix plans={plans} locale={locale} t={t} />
          </>
        )}
      </div>
    </ListPageShell>
  )
}

function previewText(args: {
  action?: "UPGRADE_NOW" | "SCHEDULE_DOWNGRADE"
  amountSar?: string
  effectiveAt?: string
  trialChange?: boolean
  locale: "ar" | "en"
  t: (key: string) => string
}) {
  if (args.trialChange) {
    return args.t("billing.plans.trialChange")
  }

  if (args.action === "SCHEDULE_DOWNGRADE" && args.effectiveAt) {
    return interpolate(args.t("billing.plans.scheduledFor"), {
      date: formatBillingDate(args.effectiveAt, args.locale),
    })
  }

  return interpolate(args.t("billing.plans.payNow"), {
    amount: args.amountSar ?? "0.00",
  })
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  )
}
