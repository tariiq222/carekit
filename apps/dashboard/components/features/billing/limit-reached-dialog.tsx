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
  const [open, setOpen] = useState(limitReached)

  if (!limitReached) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
