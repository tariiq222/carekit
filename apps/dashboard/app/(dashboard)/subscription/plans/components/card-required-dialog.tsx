"use client"

import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

interface CardRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CardRequiredDialog({ open, onOpenChange }: CardRequiredDialogProps) {
  const { t } = useLocale()
  const router = useRouter()

  function handleAddCard() {
    router.push("/subscription/payment-methods")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.plans.cardRequiredTitle")}</DialogTitle>
          <DialogDescription>{t("billing.plans.cardRequiredDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("billing.actions.back")}
          </Button>
          <Button onClick={handleAddCard}>
            {t("billing.plans.goToPaymentMethods")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
