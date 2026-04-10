"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"

/* ─── Props ─── */

interface GeneralInfoTabProps {
  form: UseFormReturn<CreateGroupFormValues>
}

/* ─── Component ─── */

export function GeneralInfoTab({ form }: GeneralInfoTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  /* ── Locale-ordered field pairs ── */
  const primaryName   = isAr ? "nameAr" : "nameEn"
  const secondaryName = isAr ? "nameEn" : "nameAr"
  const primaryDesc   = isAr ? "descriptionAr" : "descriptionEn"
  const secondaryDesc = isAr ? "descriptionEn" : "descriptionAr"
  const primaryNameLabel   = isAr ? t("groups.create.nameAr") : t("groups.create.nameEn")
  const secondaryNameLabel = isAr ? t("groups.create.nameEn") : t("groups.create.nameAr")
  const primaryDescLabel   = isAr ? t("groups.create.descAr") : t("groups.create.descEn")
  const secondaryDescLabel = isAr ? t("groups.create.descEn") : t("groups.create.descAr")
  const primaryDir   = isAr ? "rtl" : "ltr"
  const secondaryDir = isAr ? "ltr" : "rtl"

  return (
    <Card className="border-s-2 border-s-primary/40">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{t("groups.create.tabs.general")}</CardTitle>
          <CardDescription>
            {t("groups.create.tabs.general")} &mdash;{" "}
            <span className="text-destructive">*</span>{" "}
            {isAr ? "حقول إلزامية" : "required fields"}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* ── Names ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{primaryNameLabel} *</Label>
            <Input {...form.register(primaryName)} dir={primaryDir} />
            {form.formState.errors[primaryName] && (
              <p className="text-xs text-destructive">
                {form.formState.errors[primaryName]?.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{secondaryNameLabel} *</Label>
            <Input {...form.register(secondaryName)} dir={secondaryDir} />
            {form.formState.errors[secondaryName] && (
              <p className="text-xs text-destructive">
                {form.formState.errors[secondaryName]?.message}
              </p>
            )}
          </div>
        </div>

        {/* ── Descriptions ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{primaryDescLabel}</Label>
            <Textarea {...form.register(primaryDesc)} rows={3} dir={primaryDir} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{secondaryDescLabel}</Label>
            <Textarea {...form.register(secondaryDesc)} rows={3} dir={secondaryDir} />
          </div>
        </div>

        {/* ── Capacity ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.minParticipants")} *</Label>
            <Input
              type="number"
              {...form.register("minParticipants", { valueAsNumber: true })}
            />
            {form.formState.errors.minParticipants && (
              <p className="text-xs text-destructive">
                {form.formState.errors.minParticipants.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.maxParticipants")} *</Label>
            <Input
              type="number"
              {...form.register("maxParticipants", { valueAsNumber: true })}
            />
            {form.formState.errors.maxParticipants && (
              <p className="text-xs text-destructive">
                {form.formState.errors.maxParticipants.message}
              </p>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
