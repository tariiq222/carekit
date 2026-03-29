"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextAlignLeftIcon,
  Award01Icon,
  Mail01Icon,
  Certificate01Icon,
} from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { AvatarUpload } from "@/components/ui/avatar-upload"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"
import { PractitionerStatusDialog } from "@/components/features/practitioners/practitioner-status-dialog"
import type { UseFormReturn } from "react-hook-form"
import type { CreatePractitionerFormData } from "./create/form-schema"

/* ─── Props ─── */

interface BasicInfoTabProps {
  form: UseFormReturn<CreatePractitionerFormData>
  showEmail?: boolean
  practitionerName?: string
}

/* ─── Component ─── */

export function BasicInfoTab({ form, showEmail = false, practitionerName }: BasicInfoTabProps) {
  const { t } = useLocale()
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)

  const displayName = practitionerName ?? form.watch("nameEn") ?? ""

  function handleSwitchChange(v: boolean) {
    setPendingValue(v)
  }

  function handleConfirm() {
    if (pendingValue !== null) {
      form.setValue("isActive", pendingValue)
    }
    setPendingValue(null)
  }

  function handleCancel() {
    setPendingValue(null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

      {/* ── Column 1 (1/3): Personal Info ── */}
      <Card className="md:row-span-2 lg:row-span-2">
        <CardContent className="pt-6">
          {/* Avatar + switch in same row */}
          <AvatarUpload
            value={form.watch("avatarUrl") || undefined}
            onChange={(file, previewUrl) => {
              form.setValue("avatarFile", file)
              form.setValue("avatarUrl", previewUrl)
            }}
            onClear={() => {
              form.setValue("avatarFile", undefined)
              form.setValue("avatarUrl", "")
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="practitioner-active" className="cursor-pointer text-xs text-muted-foreground">
                  {t("practitioners.status.active")}
                </Label>
                <Switch
                  id="practitioner-active"
                  checked={form.watch("isActive") ?? true}
                  onCheckedChange={handleSwitchChange}
                />
              </div>

            </div>
          </AvatarUpload>

          <div className="space-y-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Certificate01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("practitioners.create.titleLabel")}
                </span>
              </Label>
              <Input
                {...form.register("title")}
                placeholder={t("practitioners.create.titlePlaceholder")}
              />
            </div>

            {/* Email (create only) */}
            {showEmail && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Mail01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("practitioners.create.emailLabel")} *
                  </span>
                </Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder="doctor@clinic.com"
                  dir="ltr"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {String(form.formState.errors.email.message ?? "")}
                  </p>
                )}
              </div>
            )}

            {/* Full Name EN */}
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("practitioners.create.nameEn")}
                {showEmail && " *"}
              </Label>
              <Input
                {...form.register("nameEn")}
                placeholder="e.g. Ahmed Al-Shammari"
                dir="ltr"
              />
              {form.formState.errors.nameEn && (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.nameEn.message ?? "")}
                </p>
              )}
            </div>

            {/* Full Name AR */}
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("practitioners.create.nameAr")}
                {showEmail && " *"}
              </Label>
              <Input
                {...form.register("nameAr")}
                placeholder="مثال: أحمد الشمري"
                dir="rtl"
              />
              {form.formState.errors.nameAr && (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.nameAr.message ?? "")}
                </p>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Column 2-3 (2/3): Specialty + Qualifications + Bio ── */}
      <Card className="md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-2">
        <CardContent className="pt-6 space-y-6">
          {/* Specialty */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={Certificate01Icon}
              title={t("practitioners.create.specialtySection")}
              description={t("practitioners.create.specialtyDescription")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="truncate">
                  {t("practitioners.create.specialty")} (EN)
                  {showEmail && " *"}
                </Label>
                <Input
                  {...form.register("specialty")}
                  placeholder="e.g. Addiction Counselor"
                />
                {form.formState.errors.specialty && (
                  <p className="text-xs text-destructive">
                    {String(form.formState.errors.specialty.message ?? "")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="truncate">{t("practitioners.create.specialty")} (AR)</Label>
                <Input
                  {...form.register("specialtyAr")}
                  placeholder="مثال: معالج إدمان"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Qualifications */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={Award01Icon}
              title={t("practitioners.create.qualifications")}
              description={t("practitioners.create.qualificationsDesc")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="truncate">{t("practitioners.create.experience")}</Label>
                <Input
                  type="number"
                  min={0}
                  {...form.register("experience")}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="truncate">{t("practitioners.create.educationEn")}</Label>
                <Input {...form.register("education")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="truncate">{t("practitioners.create.educationAr")}</Label>
                <Input {...form.register("educationAr")} dir="rtl" />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Bio */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={TextAlignLeftIcon}
              title={t("practitioners.create.bioSection")}
              description={t("practitioners.create.bioDescription")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t("practitioners.create.bioEn")}</Label>
                <Textarea {...form.register("bio")} rows={4} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("practitioners.create.bioAr")}</Label>
                <Textarea {...form.register("bioAr")} rows={4} dir="rtl" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PractitionerStatusDialog
        open={pendingValue !== null}
        targetStatus={pendingValue ?? true}
        practitionerName={displayName}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
