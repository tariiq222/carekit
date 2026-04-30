"use client"

import { useState } from "react"
import { Input } from "@carekit/ui"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

interface CancelSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  confirmLabel?: string
  onConfirm: (reason?: string) => Promise<void>
}

export function CancelSubscriptionDialog(props: CancelSubscriptionDialogProps) {
  const { open, onOpenChange, pending, confirmLabel, onConfirm } = props
  const { t } = useLocale()
  const [reason, setReason] = useState("")

  async function handleConfirm() {
    await onConfirm(reason || undefined)
    setReason("")
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("billing.cancel.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("billing.cancel.dialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("billing.cancel.reasonLabel")}
          </label>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("billing.cancel.reasonPlaceholder")}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("billing.cancel.keep")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
            disabled={pending}
            className="bg-error text-white hover:bg-error/90"
          >
            {pending ? t("billing.actions.canceling") : confirmLabel ?? t("billing.cancel.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
