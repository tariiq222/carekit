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
} from "@/components/ui/alert-dialog"
import { useLocale } from "@/components/locale-provider"

interface Props {
  open: boolean
  targetStatus: boolean // true = activating, false = suspending
  practitionerName: string
  onConfirm: () => void
  onCancel: () => void
}

export function PractitionerStatusDialog({
  open,
  targetStatus,
  practitionerName,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLocale()

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {targetStatus
              ? t("practitioners.status.activateTitle")
              : t("practitioners.status.suspendTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {targetStatus
              ? t("practitioners.status.activateDesc").replace("{name}", practitionerName)
              : t("practitioners.status.suspendDesc").replace("{name}", practitionerName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              targetStatus
                ? ""
                : "bg-destructive text-white hover:bg-destructive/90"
            }
          >
            {targetStatus
              ? t("practitioners.status.confirmActivate")
              : t("practitioners.status.confirmSuspend")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
