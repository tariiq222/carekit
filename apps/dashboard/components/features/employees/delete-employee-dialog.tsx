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
import { useEmployeeMutations } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import type { Employee } from "@/lib/types/employee"

/* ─── Props ─── */

interface DeleteEmployeeDialogProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: DeleteEmployeeDialogProps) {
  const { deleteMutation } = useEmployeeMutations()
  const { t } = useLocale()

  const handleDelete = async () => {
    if (!employee) return
    try {
      await deleteMutation.mutateAsync(employee.id)
      toast.success(t("employees.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("employees.delete.error"))
    }
  }

  const name = employee
    ? `${employee.user.firstName} ${employee.user.lastName}`
    : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("employees.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("employees.delete.descriptionPrefix")}{" "}
            <strong>{name}</strong>
            {t("employees.delete.descriptionSuffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            {t("employees.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? t("employees.delete.submitting") : t("employees.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
