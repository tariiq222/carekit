"use client"

import { useState } from "react"
import { Badge, Button, Card, Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations, usePlans } from "@/hooks/use-current-subscription"
import type { Plan, Subscription, SubscriptionStatus, BillingCycle } from "@/lib/types/billing"

/* ─── Status badge ─── */

const statusStyles: Record<SubscriptionStatus, { bg: string; text: string; border: string; label: { ar: string; en: string } }> = {
  ACTIVE:   { bg: "bg-success/10",     text: "text-success",     border: "border-success/30",     label: { ar: "نشط",       en: "Active"   } },
  TRIALING: { bg: "bg-accent/10",      text: "text-accent",      border: "border-accent/30",      label: { ar: "تجريبي",    en: "Trial"    } },
  PAST_DUE: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: { ar: "متأخر",     en: "Past due" } },
  SUSPENDED:{ bg: "bg-muted",          text: "text-muted-foreground", border: "border-border",    label: { ar: "موقوف",     en: "Suspended"} },
  CANCELED: { bg: "bg-muted",          text: "text-muted-foreground", border: "border-border",    label: { ar: "ملغى",      en: "Canceled" } },
}

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const s = statusStyles[status]
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", s.bg, s.text, s.border)}
    >
      {isAr ? s.label.ar : s.label.en}
    </Badge>
  )
}

/* ─── Plan selector dialog (inline, simple) ─── */

interface PlanSelectorProps {
  plans: Plan[]
  currentPlanId: string
  onSelect: (planId: string, billingCycle: BillingCycle) => void
  isPending: boolean
  onCancel: () => void
}

function PlanSelector({ plans, currentPlanId, onSelect, isPending, onCancel }: PlanSelectorProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId)
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY")

  const upgradable = plans.filter((p) => p.id !== currentPlanId)

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">
        {isAr ? "اختر الخطة" : "Select a plan"}
      </p>

      <div className="flex gap-2">
        <Button
          variant={cycle === "MONTHLY" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("MONTHLY")}
        >
          {isAr ? "شهري" : "Monthly"}
        </Button>
        <Button
          variant={cycle === "ANNUAL" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("ANNUAL")}
        >
          {isAr ? "سنوي" : "Annual"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {upgradable.map((plan) => {
          const price = cycle === "MONTHLY" ? plan.priceMonthly : plan.priceAnnual
          const name  = isAr ? plan.nameAr : plan.nameEn
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={cn(
                "rounded-lg border p-3 text-start transition-colors",
                selectedPlanId === plan.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-sm text-muted-foreground">
                {plan.currency} {price}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending || selectedPlanId === currentPlanId}
          onClick={() => onSelect(selectedPlanId, cycle)}
        >
          {isPending
            ? (isAr ? "جارٍ التحديث…" : "Updating…")
            : (isAr ? "تأكيد" : "Confirm")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </div>
  )
}

/* ─── Main card ─── */

interface CurrentPlanCardProps {
  subscription?: Subscription | null
  plans?: Plan[]
  isLoading: boolean
}

export function CurrentPlanCard({ subscription, plans, isLoading }: CurrentPlanCardProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { upgradeMut, downgradeMut, cancelMut, resumeMut } = useBillingMutations()
  const { data: allPlans } = usePlans()

  const planList = plans ?? allPlans ?? []

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-sm">
          {isAr ? "لا يوجد اشتراك نشط." : "No active subscription."}
        </p>
      </Card>
    )
  }

  const planName   = isAr ? subscription.plan.nameAr : subscription.plan.nameEn
  const periodEnd  = new Date(subscription.currentPeriodEnd).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
  })
  const trialEnd   = subscription.trialEndsAt
    ? new Date(subscription.trialEndsAt).toLocaleDateString("ar-SA", {
        year: "numeric", month: "short", day: "numeric",
      })
    : null

  const canUpgrade  = ["BASIC", "PRO"].includes(subscription.plan.slug)
  const canCancel   = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(subscription.status)
  const canResume   = subscription.status === "SUSPENDED"

  const isPending =
    upgradeMut.isPending || downgradeMut.isPending || cancelMut.isPending || resumeMut.isPending

  const handleUpgradeSelect = (planId: string, billingCycle: BillingCycle) => {
    const targetPlan = planList.find((p) => p.id === planId)
    if (!targetPlan) return
    const isDowngrade = targetPlan.sortOrder < subscription.plan.sortOrder
    if (isDowngrade) {
      downgradeMut.mutate({ planId, billingCycle }, { onSuccess: () => setShowUpgrade(false) })
    } else {
      upgradeMut.mutate({ planId, billingCycle }, { onSuccess: () => setShowUpgrade(false) })
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{planName}</h2>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {isAr ? "تاريخ التجديد القادم: " : "Next billing date: "}
            <span className="font-medium text-foreground">{periodEnd}</span>
          </p>
          {trialEnd && (
            <p className="text-sm text-muted-foreground">
              {isAr ? "تنتهي الفترة التجريبية: " : "Trial ends: "}
              <span className="font-medium text-foreground">{trialEnd}</span>
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {canUpgrade && !showUpgrade && (
            <Button size="sm" onClick={() => setShowUpgrade(true)}>
              {isAr ? "ترقية الخطة" : "Upgrade plan"}
            </Button>
          )}
          {canResume && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => resumeMut.mutate()}
            >
              {resumeMut.isPending
                ? (isAr ? "جارٍ الاستئناف…" : "Resuming…")
                : (isAr ? "استئناف الاشتراك" : "Resume subscription")}
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={() => cancelMut.mutate(undefined)}
            >
              {cancelMut.isPending
                ? (isAr ? "جارٍ الإلغاء…" : "Canceling…")
                : (isAr ? "إلغاء الاشتراك" : "Cancel subscription")}
            </Button>
          )}
        </div>
      </div>

      {showUpgrade && planList.length > 0 && (
        <PlanSelector
          plans={planList}
          currentPlanId={subscription.plan.id}
          onSelect={handleUpgradeSelect}
          isPending={isPending}
          onCancel={() => setShowUpgrade(false)}
        />
      )}
    </Card>
  )
}
