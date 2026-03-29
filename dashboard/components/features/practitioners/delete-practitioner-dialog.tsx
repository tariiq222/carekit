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
import { usePractitionerMutations } from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"
import type { Practitioner } from "@/lib/types/practitioner"

/* ─── Props ─── */

interface DeletePractitionerDialogProps {
  practitioner: Practitioner | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeletePractitionerDialog({
  practitioner,
  open,
  onOpenChange,
}: DeletePractitionerDialogProps) {
  const { deleteMutation } = usePractitionerMutations()
  const { t } = useLocale()

  const handleDelete = async () => {
    if (!practitioner) return
    try {
      await deleteMutation.mutateAsync(practitioner.id)
      toast.success(t("practitioners.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("practitioners.delete.error"))
    }
  }

  const name = practitioner
    ? `${practitioner.user.firstName} ${practitioner.user.lastName}`
    : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("practitioners.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("practitioners.delete.descriptionPrefix")}{" "}
            <strong>{name}</strong>
            {t("practitioners.delete.descriptionSuffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            {t("practitioners.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? t("practitioners.delete.submitting") : t("practitioners.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
