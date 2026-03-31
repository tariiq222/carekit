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
import { BookingTypesEditor } from "./booking-types-editor"
import { IntakeFormEditor } from "./intake-form-editor"
import type { Service } from "@/lib/types/service"

/* ─── Schema ─── */

const editServiceSchema = z.object({
  nameEn: z.string().min(1, "Required").optional(),
  nameAr: z.string().min(1, "Required").optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().uuid("Must be a valid UUID").optional(),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  hidePriceOnBooking: z.boolean().optional(),
  hideDurationOnBooking: z.boolean().optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  allowRecurring: z.boolean().optional(),
  maxParticipants: z.coerce.number().int().min(1).max(100).optional(),
  minLeadMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
})

type FormData = z.infer<typeof editServiceSchema>

/* ─── Props ─── */

interface EditServiceDialogProps {
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditServiceDialog({
  service,
  open,
  onOpenChange,
}: EditServiceDialogProps) {
  const { t, locale } = useLocale()
  const { updateMut } = useServiceMutations()
  const { data: categories, isLoading: loadingCategories } = useCategories()

  const form = useForm<FormData>({
    resolver: zodResolver(editServiceSchema),
  })

  /* Populate form when service changes */
  useEffect(() => {
    if (service) {
      form.reset({
        nameEn: service.nameEn,
        nameAr: service.nameAr,
        descriptionEn: service.descriptionEn ?? "",
        descriptionAr: service.descriptionAr ?? "",
        categoryId: service.categoryId,
        isActive: service.isActive,
        isHidden: service.isHidden,
        hidePriceOnBooking: service.hidePriceOnBooking,
        hideDurationOnBooking: service.hideDurationOnBooking,
        bufferMinutes: service.bufferMinutes,
        depositEnabled: service.depositEnabled,
        depositPercent: service.depositPercent,
        allowRecurring: service.allowRecurring,
        maxParticipants: service.maxParticipants,
        minLeadMinutes: service.minLeadMinutes,
        maxAdvanceDays: service.maxAdvanceDays,
      })
    }
  }, [service, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!service) return
    try {
      const payload = {
        id: service.id,
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        descriptionEn: data.descriptionEn || undefined,
        descriptionAr: data.descriptionAr || undefined,
        categoryId: data.categoryId,
        isActive: data.isActive,
        isHidden: data.isHidden,
        hidePriceOnBooking: data.hidePriceOnBooking,
        hideDurationOnBooking: data.hideDurationOnBooking,
        bufferMinutes: data.bufferMinutes,
        depositEnabled: data.depositEnabled,
        depositPercent: data.depositPercent,
        allowRecurring: data.allowRecurring,
        maxParticipants: data.maxParticipants,
        minLeadMinutes: data.minLeadMinutes,
        maxAdvanceDays: data.maxAdvanceDays,
      }
      await updateMut.mutateAsync(payload)
      toast.success(t("services.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.edit.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("services.edit.title")}</SheetTitle>
          <SheetDescription>{t("services.edit.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="edit-service-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-service-active" className="cursor-pointer">
                {t("services.edit.isActive")}
              </Label>
              <Switch
                id="edit-service-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameEn")}</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameAr")}</Label>
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
              <Label>{t("services.create.category")}</Label>
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
            </div>

            {/* Display Settings — card */}
            <Separator />
            <div className="rounded-lg border border-border p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {locale === "ar" ? "إعدادات العرض" : "Display Settings"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? "التحكم في الظهور وخيارات العرض" : "Control visibility and display options"}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="edit-service-hidden" className="cursor-pointer text-xs">
                    {locale === "ar" ? "إخفاء الخدمة" : "Hide Service"}
                  </Label>
                  <Switch
                    id="edit-service-hidden"
                    checked={form.watch("isHidden")}
                    onCheckedChange={(v) => form.setValue("isHidden", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="edit-service-hide-price" className="cursor-pointer text-xs">
                    {locale === "ar" ? "إخفاء السعر عند الحجز" : "Hide Price"}
                  </Label>
                  <Switch
                    id="edit-service-hide-price"
                    checked={form.watch("hidePriceOnBooking")}
                    onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="edit-service-hide-duration" className="cursor-pointer text-xs">
                    {locale === "ar" ? "إخفاء المدة عند الحجز" : "Hide Duration"}
                  </Label>
                  <Switch
                    id="edit-service-hide-duration"
                    checked={form.watch("hideDurationOnBooking")}
                    onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
                  />
                </div>
              </div>

            </div>

            {/* Service Booking Settings */}
            <ServiceBookingSettings form={form} locale={locale} />
          </form>

          {/* Booking Types & Pricing (saves independently) */}
          {service && (
            <BookingTypesEditor serviceId={service.id} />
          )}

          {/* Intake Forms (saves independently) */}
          {service && (
            <IntakeFormEditor serviceId={service.id} locale={locale} />
          )}
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("services.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-service-form" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("services.edit.submitting") : t("services.edit.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
