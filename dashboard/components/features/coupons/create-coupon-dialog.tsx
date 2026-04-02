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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCouponMutations } from "@/hooks/use-coupons"
import { useLocale } from "@/components/locale-provider"

/* ─── Schema ─── */

const createCouponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/i, "Only letters, numbers, hyphens, underscores"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().int().min(1),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxUsesPerUser: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof createCouponSchema>

/* ─── Props ─── */

interface CreateCouponDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateCouponDialog({
  open,
  onOpenChange,
}: CreateCouponDialogProps) {
  const { t, locale } = useLocale()
  const { createMut } = useCouponMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: {
      code: "",
      descriptionEn: "",
      descriptionAr: "",
      discountType: "percentage",
      discountValue: undefined,
      minAmount: 0,
      maxUses: "",
      maxUsesPerUser: "",
      expiresAt: "",
      isActive: true,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        code: data.code.toUpperCase(),
        descriptionEn: data.descriptionEn || undefined,
        descriptionAr: data.descriptionAr || undefined,
        discountType: data.discountType as "percentage" | "fixed",
        discountValue: data.discountType === "fixed"
          ? Math.round(data.discountValue * 100)
          : data.discountValue,
        minAmount: data.minAmount ? Math.round(data.minAmount * 100) : undefined,
        maxUses: data.maxUses ? Number(data.maxUses) : undefined,
        maxUsesPerUser: data.maxUsesPerUser ? Number(data.maxUsesPerUser) : undefined,
        expiresAt: data.expiresAt || undefined,
        isActive: data.isActive,
      }
      await createMut.mutateAsync(payload)
      toast.success(t("coupons.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("coupons.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("coupons.create.title")}</SheetTitle>
          <SheetDescription>{t("coupons.create.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-coupon-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Code */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.code")} *</Label>
              <Input
                {...form.register("code")}
                placeholder="SUMMER2026"
                className="font-mono uppercase"
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.descEn")}</Label>
                <Textarea {...form.register("descriptionEn")} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.descAr")}</Label>
                <Textarea {...form.register("descriptionAr")} rows={2} dir="rtl" />
              </div>
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.discountType")} *</Label>
                <Select
                  value={form.watch("discountType")}
                  onValueChange={(v) => form.setValue("discountType", v as "percentage" | "fixed", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t("coupons.type.percentage")}</SelectItem>
                    <SelectItem value="fixed">{t("coupons.type.fixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.discountValue")} *</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("discountValue")}
                  placeholder={form.watch("discountType") === "percentage" ? "10" : "50.00"}
                />
                {form.formState.errors.discountValue && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.discountValue.message}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Limits */}
            <p className="text-sm font-medium text-foreground">
              {locale === "ar" ? "القيود" : "Limits"}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.minAmount")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("minAmount")}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.maxUses")}</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("maxUses")}
                  placeholder={locale === "ar" ? "بلا حدود" : "Unlimited"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.maxUsesPerUser")}</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("maxUsesPerUser")}
                  placeholder={locale === "ar" ? "بلا حدود" : "Unlimited"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.expiresAt")}</Label>
                <DateTimeInput
                  value={form.watch("expiresAt") ?? ""}
                  onChange={(v) => form.setValue("expiresAt", v)}
                />
              </div>
            </div>

            <Separator />

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="create-coupon-active" className="cursor-pointer">
                {t("coupons.create.isActive")}
              </Label>
              <Switch
                id="create-coupon-active"
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
            {t("coupons.create.cancel")}
          </Button>
          <Button type="submit" form="create-coupon-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("coupons.create.submitting") : t("coupons.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
