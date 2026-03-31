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
import { useServiceMutations, useCategories } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { ServiceBookingSettings } from "./service-booking-settings"

/* ─── Schema ─── */

const createServiceSchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().uuid("services.create.categoryRequired"),
  price: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().int().min(1).optional(),
  isHidden: z.boolean().optional(),
  hidePriceOnBooking: z.boolean().optional(),
  hideDurationOnBooking: z.boolean().optional(),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120).optional(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  allowRecurring: z.boolean().optional(),
  maxParticipants: z.coerce.number().int().min(1).max(100).optional(),
  minLeadMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
})

type FormData = z.infer<typeof createServiceSchema>

/* ─── Props ─── */

interface CreateServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateServiceDialog({
  open,
  onOpenChange,
}: CreateServiceDialogProps) {
  const { t, locale } = useLocale()
  const { createMut } = useServiceMutations()
  const { data: categories, isLoading: loadingCategories } = useCategories()

  const form = useForm<FormData>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      nameEn: "",
      nameAr: "",
      descriptionEn: "",
      descriptionAr: "",
      categoryId: "",
      price: undefined,
      duration: undefined,
      isHidden: false,
      hidePriceOnBooking: false,
      hideDurationOnBooking: false,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      depositEnabled: false,
      depositPercent: 100,
      allowRecurring: false,
      maxParticipants: 1,
      minLeadMinutes: null,
      maxAdvanceDays: null,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        descriptionEn: data.descriptionEn || undefined,
        descriptionAr: data.descriptionAr || undefined,
        categoryId: data.categoryId,
        price: data.price != null ? Math.round(data.price * 100) : undefined,
        duration: data.duration,
        isHidden: data.isHidden,
        hidePriceOnBooking: data.hidePriceOnBooking,
        hideDurationOnBooking: data.hideDurationOnBooking,
        bufferBeforeMinutes: data.bufferBeforeMinutes,
        bufferAfterMinutes: data.bufferAfterMinutes,
        depositEnabled: data.depositEnabled,
        depositPercent: data.depositPercent,
        allowRecurring: data.allowRecurring,
        maxParticipants: data.maxParticipants,
        minLeadMinutes: data.minLeadMinutes,
        maxAdvanceDays: data.maxAdvanceDays,
      }
      await createMut.mutateAsync(payload)
      toast.success(t("services.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("services.create.title")}</SheetTitle>
          <SheetDescription>{t("services.create.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-service-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descEn")}</Label>
                <Textarea {...form.register("descriptionEn")} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descAr")}</Label>
                <Textarea {...form.register("descriptionAr")} rows={2} dir="rtl" />
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("services.create.category")} *</Label>
              <Select
                value={form.watch("categoryId")}
                onValueChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
                disabled={loadingCategories}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("services.create.categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId && (
                <p className="text-xs text-destructive">
                  {t(form.formState.errors.categoryId.message ?? "services.create.categoryRequired")}
                </p>
              )}
            </div>

            {/* Price & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.price")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("price")}
                  placeholder={t("services.create.pricePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.duration")}</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("duration")}
                  placeholder={t("services.create.durationPlaceholder")}
                />
              </div>
            </div>

            {/* Display Settings */}
            <Separator />
            <p className="text-sm font-medium text-foreground">
              {locale === "ar" ? "إعدادات العرض" : "Display Settings"}
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="create-service-hidden" className="cursor-pointer text-xs">
                  {locale === "ar" ? "إخفاء الخدمة" : "Hide Service"}
                </Label>
                <Switch
                  id="create-service-hidden"
                  checked={form.watch("isHidden")}
                  onCheckedChange={(v) => form.setValue("isHidden", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="create-service-hide-price" className="cursor-pointer text-xs">
                  {locale === "ar" ? "إخفاء السعر عند الحجز" : "Hide Price"}
                </Label>
                <Switch
                  id="create-service-hide-price"
                  checked={form.watch("hidePriceOnBooking")}
                  onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="create-service-hide-duration" className="cursor-pointer text-xs">
                  {locale === "ar" ? "إخفاء المدة عند الحجز" : "Hide Duration"}
                </Label>
                <Switch
                  id="create-service-hide-duration"
                  checked={form.watch("hideDurationOnBooking")}
                  onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
                />
              </div>
            </div>

            {/* Service Booking Settings */}
            <ServiceBookingSettings form={form} locale={locale} />
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("services.create.cancel")}
          </Button>
          <Button type="submit" form="create-service-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("services.create.submitting") : t("services.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
