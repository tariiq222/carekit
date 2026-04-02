"use client"

import { useEffect } from "react"
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
import type { Coupon } from "@/lib/types/coupon"

/* ─── Schema ─── */

const editCouponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/i).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.coerce.number().int().min(1).optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxUsesPerUser: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof editCouponSchema>

/* ─── Props ─── */

interface EditCouponDialogProps {
  coupon: Coupon | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditCouponDialog({
  coupon,
  open,
  onOpenChange,
}: EditCouponDialogProps) {
  const { t, locale } = useLocale()
  const { updateMut } = useCouponMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(editCouponSchema),
  })

  useEffect(() => {
    if (coupon && open) {
      form.reset({
        code: coupon.code,
        descriptionEn: coupon.descriptionEn ?? "",
        descriptionAr: coupon.descriptionAr ?? "",
        discountType: coupon.discountType,
        discountValue: coupon.discountType === "fixed"
          ? coupon.discountValue / 100
          : coupon.discountValue,
        minAmount: coupon.minAmount / 100,
        maxUses: coupon.maxUses ?? ("" as unknown as number),
        maxUsesPerUser: coupon.maxUsesPerUser ?? ("" as unknown as number),
        expiresAt: coupon.expiresAt
          ? new Date(coupon.expiresAt).toISOString().slice(0, 16)
          : "",
        isActive: coupon.isActive,
      })
    }
  }, [coupon, open, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!coupon) return
    try {
      const payload = {
        id: coupon.id,
        code: data.code?.toUpperCase(),
        descriptionEn: data.descriptionEn || undefined,
        descriptionAr: data.descriptionAr || undefined,
        discountType: data.discountType as "percentage" | "fixed" | undefined,
        discountValue: data.discountValue != null
          ? (data.discountType === "fixed"
              ? Math.round(data.discountValue * 100)
              : data.discountValue)
          : undefined,
        minAmount: data.minAmount != null ? Math.round(data.minAmount * 100) : undefined,
        maxUses: data.maxUses ? Number(data.maxUses) : undefined,
        maxUsesPerUser: data.maxUsesPerUser ? Number(data.maxUsesPerUser) : undefined,
        expiresAt: data.expiresAt || undefined,
        isActive: data.isActive,
      }
      await updateMut.mutateAsync(payload)
      toast.success(t("coupons.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("coupons.edit.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("coupons.edit.title")}</SheetTitle>
          <SheetDescription>{t("coupons.edit.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="edit-coupon-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Code */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.code")} *</Label>
              <Input
                {...form.register("code")}
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
              <Label htmlFor="edit-coupon-active" className="cursor-pointer">
                {t("coupons.create.isActive")}
              </Label>
              <Switch
                id="edit-coupon-active"
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
            {t("coupons.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-coupon-form" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("coupons.edit.submitting") : t("coupons.edit.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
