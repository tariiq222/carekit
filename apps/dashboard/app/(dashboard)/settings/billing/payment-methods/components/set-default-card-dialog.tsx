"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

interface SetDefaultCardDialogProps {
  open: boolean
  pending: boolean
  cardLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function SetDefaultCardDialog({
  open,
  pending,
  cardLabel,
  onOpenChange,
  onConfirm,
}: SetDefaultCardDialogProps) {
  const { t } = useLocale()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("billing.paymentMethods.setDefault")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("billing.paymentMethods.confirmSetDefault")} {cardLabel}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("billing.actions.back")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {pending ? t("billing.actions.submitting") : t("billing.actions.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
