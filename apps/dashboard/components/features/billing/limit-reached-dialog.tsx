"use client"

import { useState } from "react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { getEmployeeUsageSummary } from "@/lib/billing/utils"
import type { Subscription } from "@/lib/types/billing"

interface LimitReachedDialogProps {
  subscription?: Subscription | null
  onUpgrade: () => void
}

export function LimitReachedDialog({ subscription, onUpgrade }: LimitReachedDialogProps) {
  const { t } = useLocale()
  const usage = getEmployeeUsageSummary(subscription)
  const limitReached = usage.ratio >= 1
  const limitKey = limitReached
    ? `${subscription?.id ?? "subscription"}:${usage.current}:${usage.max}`
    : null
  const [dismissedLimitKey, setDismissedLimitKey] = useState<string | null>(null)

  if (!limitReached || !limitKey) return null

  const open = dismissedLimitKey !== limitKey

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setDismissedLimitKey(limitKey)
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("billing.limitReached.title")}</DialogTitle>
          <DialogDescription>{t("billing.limitReached.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p className="text-sm tabular-nums text-muted-foreground">
            {usage.current} / {usage.max}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDismissedLimitKey(limitKey)}
          >
            {t("billing.limitReached.close")}
          </Button>
          <Button type="button" onClick={onUpgrade}>
            {t("billing.limitReached.upgrade")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
