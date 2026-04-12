"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLocale } from "@/components/locale-provider"
import type { Branch } from "@/lib/types/branch"

interface Props {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BranchEmployeesDialog({ branch, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const branchName = branch ? (locale === "ar" ? branch.nameAr : branch.nameEn) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("branches.employees.title")} — {branchName}
          </DialogTitle>
          <DialogDescription>
            {t("branches.employees.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            {t("branches.employees.none")}
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
