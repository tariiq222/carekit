"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import {
  type DowngradeViolation,
  type QuantitativeViolation,
  type BooleanViolation,
  isQuantitativeViolation,
  isBooleanViolation,
} from "@/lib/types/billing"

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  violations: DowngradeViolation[]
  targetPlanName: string
  onChooseHigherPlan: () => void
}

export function DowngradeViolationsDialog({
  open,
  onOpenChange,
  violations,
  targetPlanName,
  onChooseHigherPlan,
}: Props) {
  const { t } = useLocale()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("billing.downgradeViolations.title").replace("{plan}", targetPlanName)}
          </DialogTitle>
          <DialogDescription>
            {t("billing.downgradeViolations.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-4">
            {violations.map((v, idx) => (
              <li key={idx} className="border-b border-border pb-3 last:border-b-0">
                {isQuantitativeViolation(v) && <QuantitativeRow violation={v} />}
                {isBooleanViolation(v) && <BooleanRow violation={v} />}
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button onClick={onChooseHigherPlan}>
            {t("billing.downgradeViolations.actions.chooseHigherPlan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QuantitativeRow({ violation }: { violation: QuantitativeViolation }) {
  const { t } = useLocale()
  const { featureKey, current, targetMax } = violation
  const overBy = current - targetMax

  if (featureKey === "monthly_bookings") {
    return (
      <div>
        <p className="font-medium text-foreground">
          {t("billing.downgradeViolations.bookings.title")
            .replace("{current}", String(current))
            .replace("{targetMax}", String(targetMax))}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("billing.downgradeViolations.bookings.body")}
        </p>
      </div>
    )
  }

  const linkPath = featureKey === "branches" ? "/branches" : "/employees"
  const titleKey =
    featureKey === "branches"
      ? "billing.downgradeViolations.branches.title"
      : "billing.downgradeViolations.employees.title"
  const bodyKey =
    featureKey === "branches"
      ? "billing.downgradeViolations.branches.body"
      : "billing.downgradeViolations.employees.body"

  return (
    <div>
      <p className="font-medium text-foreground">
        {t(titleKey).replace("{current}", String(current)).replace("{targetMax}", String(targetMax))}
      </p>
      <p className="text-sm text-muted-foreground mb-2">
        {t(bodyKey).replace("{count}", String(overBy))}
      </p>
      <Link href={linkPath} className="text-primary text-sm underline">
        {t("billing.downgradeViolations.actions.manage")}
      </Link>
    </div>
  )
}

function BooleanRow({ violation }: { violation: BooleanViolation }) {
  const { t } = useLocale()
  const { featureKey, blockingResources } = violation
  const titleKey = `billing.downgradeViolations.boolean.${featureKey}.title`
  const bodyKey = `billing.downgradeViolations.boolean.${featureKey}.body`

  return (
    <div>
      <p className="font-medium text-foreground">
        {t(titleKey).replace("{count}", String(blockingResources.count))}
      </p>
      <p className="text-sm text-muted-foreground mb-2">{t(bodyKey)}</p>
      <Link href={blockingResources.deepLink} className="text-primary text-sm underline">
        {t("billing.downgradeViolations.actions.manage")}
      </Link>
    </div>
  )
}
