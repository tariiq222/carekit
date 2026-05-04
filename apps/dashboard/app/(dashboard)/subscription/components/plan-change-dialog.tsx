"use client"

import { useMemo, useState } from "react"
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button, Badge } from "@deqah/ui"
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
import { FEATURE_CATALOG } from "@deqah/shared/constants"
import type { BillingCycle, Plan } from "@/lib/types/billing"

const DIALOG_FEATURE_KEYS = [
  "employees",
  "branches",
  "monthly_bookings",
  "recurring_bookings",
  "waitlist",
  "ai_chatbot",
  "coupons",
  "advanced_reports",
  "intake_forms",
  "zoom_integration",
  "priority_support",
] as const

interface PlanChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plans: Plan[]
  currentPlanId: string
  currentPlanSortOrder: number
  currentCycle: BillingCycle
  pending: boolean
  onSubmit: (payload: { planId: string; billingCycle: BillingCycle }) => Promise<void>
}

function formatLimitValue(value: number | boolean | undefined, locale: "ar" | "en"): string {
  if (value === true) return "✓"
  if (value === false || value === undefined) return "—"
  if (value === -1) return locale === "ar" ? "غير محدود" : "Unlimited"
  return String(value)
}

function isIncluded(value: number | boolean | undefined): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  return false
}

export function PlanChangeDialog(props: PlanChangeDialogProps) {
  const {
    open,
    onOpenChange,
    plans,
    currentPlanId,
    currentCycle,
    pending,
    onSubmit,
  } = props
  const { t, locale } = useLocale()
  const [selectedPlanId, setSelectedPlanId] = useState(
    plans.find((plan) => plan.id !== currentPlanId)?.id ?? plans[0]?.id ?? "",
  )
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(currentCycle)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const featureEntries = useMemo(() => {
    return DIALOG_FEATURE_KEYS.map((key) => {
      const entry = FEATURE_CATALOG[key as keyof typeof FEATURE_CATALOG]
      return entry ?? null
    }).filter(Boolean)
  }, [])

  async function handleSubmit() {
    if (!selectedPlan) return
    await onSubmit({ planId: selectedPlan.id, billingCycle })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("billing.plan.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("billing.plan.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Billing cycle toggle */}
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

          <div className="grid gap-4 md:grid-cols-2">
            {/* Plan selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("billing.plan.selectPlan")}
              </p>
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
                      "w-full rounded-xl border p-4 text-start transition-colors",
                      isCurrent
                        ? "cursor-not-allowed border-border bg-muted/50 opacity-60"
                        : isSelected
                          ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40 hover:bg-primary/4",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">
                        {getLocalizedPlanName(plan, locale)}
                      </p>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("billing.plan.current")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.currency} {price}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Feature list for selected plan */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {selectedPlan
                  ? `${locale === "ar" ? "مميزات" : "Features of"} ${getLocalizedPlanName(selectedPlan, locale)}`
                  : t("billing.plans.features")}
              </p>

              {selectedPlan ? (
                <div className="rounded-xl border border-border bg-card">
                  {featureEntries.map((entry, idx) => {
                    if (!entry) return null
                    const limitValue = selectedPlan.limits[entry.key]
                    const included = isIncluded(limitValue)
                    const displayValue = formatLimitValue(limitValue, locale)
                    const isQuantitative = entry.kind === "quantitative"

                    return (
                      <div
                        key={entry.key}
                        className={cn(
                          "flex items-center justify-between gap-3 px-4 py-2.5 text-sm",
                          idx !== featureEntries.length - 1 && "border-b border-border/60",
                        )}
                      >
                        <span className="text-foreground">
                          {locale === "ar" ? entry.nameAr : entry.nameEn}
                        </span>
                        {isQuantitative ? (
                          <span className={cn(
                            "font-medium tabular-nums",
                            displayValue === "—" ? "text-muted-foreground" : "text-foreground",
                          )}>
                            {displayValue}
                          </span>
                        ) : (
                          <HugeiconsIcon
                            icon={included ? CheckmarkCircle02Icon : Cancel01Icon}
                            size={16}
                            className={included ? "text-success" : "text-muted-foreground"}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {t("billing.plan.selectToSeeFeatures")}
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("billing.actions.back")}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!selectedPlan || selectedPlan.id === currentPlanId || pending}
          >
            {pending ? t("billing.actions.submitting") : t("billing.actions.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
