"use client"

import { toast } from "sonner"

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
import { usePractitionerServiceMutations } from "@/hooks/use-practitioners"
import type { PractitionerService } from "@/lib/types/practitioner"

/* ─── Props ─── */

interface RemoveServiceDialogProps {
  practitionerId: string
  practitionerService: PractitionerService | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function RemoveServiceDialog({
  practitionerId,
  practitionerService: ps,
  open,
  onOpenChange,
}: RemoveServiceDialogProps) {
  const { locale, t } = useLocale()
  const { removeMut } = usePractitionerServiceMutations(practitionerId)

  const serviceName = ps
    ? locale === "ar"
      ? ps.service.nameAr
      : ps.service.nameEn
    : ""

  const handleRemove = async () => {
    if (!ps) return
    try {
      await removeMut.mutateAsync(ps.serviceId)
      toast.success(t("practitioners.services.removeSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove service",
      )
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("practitioners.services.remove")} — {serviceName}
          </AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            <span>{t("practitioners.services.removeConfirm")}</span>
            <span className="text-xs text-muted-foreground">
              {t("practitioners.services.removeWarning")}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMut.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeMut.isPending
              ? t("practitioners.services.saving")
              : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
