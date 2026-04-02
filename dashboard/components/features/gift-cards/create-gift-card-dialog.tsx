"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { DateTimeInput } from "@/components/ui/date-time-input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useGiftCardMutations } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"

/* ─── Schema ─── */

const createGiftCardSchema = z.object({
  code: z.string().max(20).regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, hyphens").optional().or(z.literal("")),
  initialAmount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof createGiftCardSchema>

/* ─── Props ─── */

interface CreateGiftCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateGiftCardDialog({
  open,
  onOpenChange,
}: CreateGiftCardDialogProps) {
  const { t, locale } = useLocale()
  const { createMut } = useGiftCardMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createGiftCardSchema),
    defaultValues: {
      code: "",
      initialAmount: undefined,
      expiresAt: "",
      isActive: true,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        code: data.code || undefined,
        initialAmount: Math.round(data.initialAmount * 100), // SAR to halalat
        expiresAt: data.expiresAt || undefined,
        isActive: data.isActive,
      }
      await createMut.mutateAsync(payload)
      toast.success(t("giftCards.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("giftCards.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("giftCards.create.title")}</SheetTitle>
          <SheetDescription>{t("giftCards.create.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-gift-card-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("giftCards.create.amount")} *</Label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                {...form.register("initialAmount")}
                placeholder="100.00"
              />
              {form.formState.errors.initialAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.initialAmount.message}
                </p>
              )}
            </div>

            {/* Code (optional) */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("giftCards.create.code")}</Label>
              <Input
                {...form.register("code")}
                placeholder={locale === "ar" ? "تلقائي إذا فارغ" : "Auto-generated if empty"}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                {t("giftCards.create.codeHint")}
              </p>
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Expiry */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("giftCards.create.expiresAt")}</Label>
              <DateTimeInput
              value={form.watch("expiresAt") ?? ""}
              onChange={(v) => form.setValue("expiresAt", v)}
            />
            </div>

            <Separator />

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="create-gc-active" className="cursor-pointer">
                {t("giftCards.create.isActive")}
              </Label>
              <Switch
                id="create-gc-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("giftCards.create.cancel")}
          </Button>
          <Button type="submit" form="create-gift-card-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("giftCards.create.submitting") : t("giftCards.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
