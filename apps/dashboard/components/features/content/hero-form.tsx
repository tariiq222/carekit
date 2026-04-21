"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@carekit/ui"
import { heroFormSchema, type HeroFormSchema } from "@/lib/schemas/hero.schema"
import {
  HERO_DEFAULTS,
  HERO_KEY_MAP,
  type HeroFormValues,
  type SiteSettingRow,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"

function rowToText(row: SiteSettingRow | undefined, fallback: string): string {
  if (!row) return fallback
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback
}

function rowToMedia(row: SiteSettingRow | undefined, fallback: string): string {
  return row?.valueMedia ?? fallback
}

function buildInitial(rows: SiteSettingRow[]): HeroFormValues {
  const map = new Map(rows.map((r) => [r.key, r]))
  const next: HeroFormValues = { ...HERO_DEFAULTS }
  ;(Object.keys(HERO_KEY_MAP) as (keyof HeroFormValues)[]).forEach((field) => {
    const key = HERO_KEY_MAP[field]
    const row = map.get(key)
    if (field === "heroImageUrl") {
      next[field] = rowToMedia(row, HERO_DEFAULTS[field])
    } else {
      next[field] = rowToText(row, HERO_DEFAULTS[field])
    }
  })
  return next
}

interface Props {
  rows: SiteSettingRow[]
}

export function HeroForm({ rows }: Props) {
  const mutation = useUpsertSiteSettings()
  const form = useForm<HeroFormSchema>({
    resolver: zodResolver(heroFormSchema),
    defaultValues: HERO_DEFAULTS,
  })

  useEffect(() => {
    form.reset(buildInitial(rows))
  }, [rows, form])

  const onSubmit = (values: HeroFormSchema) => {
    const entries = (Object.keys(HERO_KEY_MAP) as (keyof HeroFormValues)[]).map(
      (field) => {
        const key = HERO_KEY_MAP[field]
        if (field === "heroImageUrl") {
          return { key, valueMedia: values[field] }
        }
        if (field === "ctaPrimaryHref" || field === "ctaSecondaryHref") {
          return { key, valueText: values[field] }
        }
        return { key, valueAr: values[field] }
      },
    )
    mutation.mutate({ entries })
  }

  const reg = form.register
  const errs = form.formState.errors

  const Field = ({
    label,
    field,
    multiline,
  }: {
    label: string
    field: keyof HeroFormValues
    multiline?: boolean
  }) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      {multiline ? (
        <Textarea id={field} rows={3} {...reg(field)} />
      ) : (
        <Input id={field} {...reg(field)} />
      )}
      {errs[field] ? (
        <p className="text-xs text-destructive">{errs[field]?.message}</p>
      ) : null}
    </div>
  )

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2">
        <Field label="نص الشارة (أعلى العنوان)" field="badgeText" />
        <Field label="الوصف" field="subtitle" multiline />
        <Field label="بداية العنوان" field="titlePrefix" />
        <Field label="النص المميّز (ملوّن)" field="titleHighlight" />
        <Field label="نهاية العنوان" field="titleSuffix" />
        <Field label="رابط الصورة الرئيسية" field="heroImageUrl" />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Field label="نص الزر الرئيسي" field="ctaPrimaryText" />
        <Field label="رابط الزر الرئيسي" field="ctaPrimaryHref" />
        <Field label="نص الزر الثانوي" field="ctaSecondaryText" />
        <Field label="رابط الزر الثانوي" field="ctaSecondaryHref" />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Field label="الشارة العلوية — العنوان" field="badgeFloatTopLabel" />
        <Field label="الشارة العلوية — القيمة" field="badgeFloatTopValue" />
        <Field label="الشارة السفلية — العنوان" field="badgeFloatBottomLabel" />
        <Field label="الشارة السفلية — القيمة" field="badgeFloatBottomValue" />
      </section>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(buildInitial(rows))}
        >
          استعادة
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </Button>
      </div>
    </form>
  )
}
