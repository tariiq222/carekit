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
import type { Branch } from "@/lib/types/branch"

interface DeleteBranchDialogProps {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteBranchDialog({
  branch,
  open,
  onOpenChange,
}: DeleteBranchDialogProps) {
  const { t, locale } = useLocale()

  const branchName = branch
    ? (locale === "ar" ? branch.nameAr : branch.nameEn)
    : ""

  const handleDelete = () => {
    toast.error(t("branches.delete.error"))
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("branches.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("branches.delete.description").replace("{name}", branchName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("branches.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("branches.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
