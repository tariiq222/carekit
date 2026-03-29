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
import { useCategoryMutations } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

/* ─── Props ─── */

interface DeleteCategoryDialogProps {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
}: DeleteCategoryDialogProps) {
  const { t } = useLocale()
  const { deleteMut } = useCategoryMutations()

  const handleDelete = async () => {
    if (!category) return
    try {
      await deleteMut.mutateAsync(category.id)
      toast.success(t("services.categories.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("services.categories.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("services.categories.delete.description").replace("{name}", category?.nameEn ?? "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("services.categories.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("services.categories.delete.submitting")
              : t("services.categories.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
