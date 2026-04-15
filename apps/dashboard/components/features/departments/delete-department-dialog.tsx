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
import { useDepartmentMutations } from "@/hooks/use-departments"
import type { Department } from "@/lib/types/department"

interface DeleteDepartmentDialogProps {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
}: DeleteDepartmentDialogProps) {
  const { t, locale } = useLocale()
  const { deleteMut } = useDepartmentMutations()

  const name = department
    ? (locale === "ar" ? department.nameAr : department.nameEn)
    : ""

  const handleDelete = async () => {
    if (!department) return
    try {
      await deleteMut.mutateAsync(department.id)
      toast.success(t("departments.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("departments.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("departments.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("departments.delete.description").replace("{name}", name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("departments.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("departments.delete.submitting")
              : t("departments.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
