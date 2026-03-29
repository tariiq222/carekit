"use client"

import { Button } from "@/components/ui/button"
import { ColorSwatchInput } from "@/components/features/shared/color-swatch-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategories } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { ServiceAvatarPicker } from "@/components/features/services/service-avatar-picker"
import { ServiceBranchesTab } from "@/components/features/services/service-branches-tab"
import { ServicePractitionersTab } from "@/components/features/services/service-practitioners-tab"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "./form-schema"

/* ─── Props ─── */

interface BasicInfoTabProps {
  form: UseFormReturn<CreateServiceFormData>
  onImageSelect?: (file: File) => void
  serviceId?: string
  serviceBranches?: { branchId: string }[]
  isCreate?: boolean
  pendingPractitionerIds?: string[]
  onPendingPractitionerChange?: (ids: string[]) => void
}

/* ─── Component ─── */

export function BasicInfoTab({ form, onImageSelect, serviceId, serviceBranches, isCreate, pendingPractitionerIds, onPendingPractitionerChange }: BasicInfoTabProps) {
  const { t, locale } = useLocale()
  const { data: categories, isLoading: loadingCategories } = useCategories()

  const {
    isActive,
    isHidden,
    hidePriceOnBooking,
    hideDurationOnBooking,
    calendarColor,
    categoryId: watchedCategoryId,
    iconName,
    iconBgColor,
    imageUrl,
  } = form.watch()

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle>{t("services.create.tabs.basic")}</CardTitle>
        <CardDescription>
          {t("services.create.tabs.basicDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Avatar + Branch Restrictions — same row */}
        <div className="flex flex-col gap-4 pb-4 mb-2 border-b border-border sm:flex-row sm:items-start">
          <div className="flex items-center gap-4 shrink-0">
            <ServiceAvatarPicker
              iconName={iconName}
              iconBgColor={iconBgColor}
              imageUrl={imageUrl}
              serviceName={form.watch("nameAr") || form.watch("nameEn")}
              onIconChange={(name, color) => {
                form.setValue("iconName", name)
                form.setValue("iconBgColor", color)
                form.setValue("imageUrl", null)
              }}
              onImageChange={(file) => {
                const url = URL.createObjectURL(file)
                form.setValue("imageUrl", url)
                form.setValue("iconName", null)
                form.setValue("iconBgColor", null)
                onImageSelect?.(file)
              }}
              onClear={() => {
                form.setValue("iconName", null)
                form.setValue("iconBgColor", null)
                form.setValue("imageUrl", null)
              }}
            />
            <p className="text-sm text-muted-foreground sm:hidden">
              {t("services.create.avatarHint") || "اختر أيقونة أو ارفع صورة للخدمة"}
            </p>
          </div>
          <div className="flex-1">
            <ServiceBranchesTab serviceId={serviceId} serviceBranches={serviceBranches} />
          </div>
        </div>

        {/* Name — primary locale field appears first (start side) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {locale === "ar" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.nameEn")} *</Label>
                <Input {...form.register("nameEn")} dir="ltr" />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Description — primary locale field appears first (start side) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {locale === "ar" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descAr")}</Label>
                <Textarea {...form.register("descriptionAr")} rows={3} dir="rtl" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descEn")}</Label>
                <Textarea {...form.register("descriptionEn")} rows={3} dir="ltr" />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descEn")}</Label>
                <Textarea {...form.register("descriptionEn")} rows={3} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.create.descAr")}</Label>
                <Textarea {...form.register("descriptionAr")} rows={3} dir="rtl" />
              </div>
            </>
          )}
        </div>

        {/* Category + Active Toggle — same row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("services.create.category")} *</Label>
            <Select
              key={categories ? watchedCategoryId || "empty" : "loading"}
              value={watchedCategoryId || undefined}
              onValueChange={(v) =>
                form.setValue("categoryId", v, { shouldValidate: true })
              }
              disabled={loadingCategories}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t("services.create.categoryPlaceholder")}
                />
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

          <div className="flex flex-col gap-1.5">
            <Label>&nbsp;</Label>
            <div className="flex h-9 items-center justify-between rounded-lg border border-border px-3">
              <Label htmlFor="create-service-active" className="cursor-pointer text-sm">
                {t("services.create.isActive")}
              </Label>
              <Switch
                id="create-service-active"
                checked={isActive}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Practitioners — separate card */}
    <Card>
      <CardHeader>
        <CardTitle>{t("services.tabs.practitioners")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ServicePractitionersTab
          serviceId={serviceId}
          isCreate={isCreate}
          pendingIds={pendingPractitionerIds}
          onPendingChange={onPendingPractitionerChange}
        />
      </CardContent>
    </Card>

    {/* Display Settings — separate card */}
    <Card>
      <CardHeader>
        <CardTitle>{t("services.create.tabs.display")}</CardTitle>
        <CardDescription>
          {t("services.create.tabs.displayDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hidden" className="cursor-pointer text-xs">
              {t("services.display.hideService")}
            </Label>
            <Switch
              id="create-hidden"
              checked={isHidden}
              onCheckedChange={(v) => form.setValue("isHidden", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hide-price" className="cursor-pointer text-xs">
              {t("services.display.hidePrice")}
            </Label>
            <Switch
              id="create-hide-price"
              checked={hidePriceOnBooking}
              onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hide-duration" className="cursor-pointer text-xs">
              {t("services.display.hideDuration")}
            </Label>
            <Switch
              id="create-hide-duration"
              checked={hideDurationOnBooking}
              onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-calendar-color">
            {t("services.display.calendarColor")}
          </Label>
          <ColorSwatchInput
            id="create-calendar-color"
            value={calendarColor}
            onChange={(v) => form.setValue("calendarColor", v)}
            onClear={() => form.setValue("calendarColor", null)}
            showHex
          />
        </div>
      </CardContent>
    </Card>
    </>
  )
}
