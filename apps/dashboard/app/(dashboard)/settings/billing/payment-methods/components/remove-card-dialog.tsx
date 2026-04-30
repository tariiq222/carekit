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
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

interface RemoveCardDialogProps {
  open: boolean
  pending: boolean
  cardLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function RemoveCardDialog({
  open,
  pending,
  cardLabel,
  onOpenChange,
  onConfirm,
}: RemoveCardDialogProps) {
  const { t } = useLocale()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("billing.paymentMethods.remove")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("billing.paymentMethods.confirmRemove")} {cardLabel}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("billing.actions.back")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-error text-white hover:bg-error/90"
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
