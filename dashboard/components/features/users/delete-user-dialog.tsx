"use client"

import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

import { useUserMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import type { User } from "@/lib/types/user"

/* ─── Props ─── */

interface DeleteUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const { deleteMut } = useUserMutations()
  const { t } = useLocale()

  const handleDelete = async () => {
    if (!user) return
    try {
      await deleteMut.mutateAsync(user.id)
      toast.success(t("users.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.delete.error"))
    }
  }

  const userName = user ? `${user.firstName} ${user.lastName}` : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>{t("users.delete.title")}</SheetTitle>
          <SheetDescription>
            {t("users.delete.descriptionPrefix")}{" "}
            <strong>{userName}</strong>
            {t("users.delete.descriptionSuffix")}
          </SheetDescription>
        </SheetHeader>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("users.delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? t("users.delete.submitting") : t("users.delete.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
