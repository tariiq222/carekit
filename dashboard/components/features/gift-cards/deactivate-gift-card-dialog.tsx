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
import { useGiftCardMutations } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"
import type { GiftCard } from "@/lib/types/gift-card"

/* ─── Props ─── */

interface DeactivateGiftCardDialogProps {
  giftCard: GiftCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeactivateGiftCardDialog({
  giftCard,
  open,
  onOpenChange,
}: DeactivateGiftCardDialogProps) {
  const { t } = useLocale()
  const { deactivateMut } = useGiftCardMutations()

  const handleDeactivate = async () => {
    if (!giftCard) return
    try {
      await deactivateMut.mutateAsync(giftCard.id)
      toast.success(t("giftCards.deactivate.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("giftCards.deactivate.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("giftCards.deactivate.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("giftCards.deactivate.description").replace("{code}", giftCard?.code ?? "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivateMut.isPending}>
            {t("giftCards.deactivate.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={deactivateMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deactivateMut.isPending ? t("giftCards.deactivate.submitting") : t("giftCards.deactivate.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
