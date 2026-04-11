"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useGiftCardMutations } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"
import type { GiftCard } from "@/lib/types/gift-card"
import {
  addCreditSchema,
  type AddCreditFormData,
} from "@/lib/schemas/payment.schema"

/* ─── Props ─── */

interface AddCreditDialogProps {
  giftCard: GiftCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function AddCreditDialog({
  giftCard,
  open,
  onOpenChange,
}: AddCreditDialogProps) {
  const { t } = useLocale()
  const { addCreditMut } = useGiftCardMutations()

  const form = useForm<AddCreditFormData>({
    resolver: zodResolver(addCreditSchema),
    defaultValues: {
      amount: undefined,
      note: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    if (!giftCard) return
    try {
      await addCreditMut.mutateAsync({
        id: giftCard.id,
        amount: Math.round(data.amount * 100), // SAR to halalat
        note: data.note || undefined,
      })
      toast.success(t("giftCards.credit.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("giftCards.credit.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("giftCards.credit.title")}</DialogTitle>
          <DialogDescription>
            {t("giftCards.credit.description").replace("{code}", giftCard?.code ?? "")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="add-credit-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label>{t("giftCards.credit.amount")} *</Label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                {...form.register("amount")}
                placeholder="50.00"
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("giftCards.credit.note")}</Label>
              <Textarea
                {...form.register("note")}
                rows={3}
                placeholder={t("giftCards.credit.notePlaceholder")}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("giftCards.credit.cancel")}
          </Button>
          <Button type="submit" form="add-credit-form" disabled={addCreditMut.isPending}>
            {addCreditMut.isPending ? t("giftCards.credit.submitting") : t("giftCards.credit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
