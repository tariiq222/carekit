"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  useDurationOptions,
  useDurationOptionsMutation,
} from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"

interface DraftOption {
  key: string
  label: string
  labelAr: string
  durationMinutes: number
  price: number // SAR display value
  isDefault: boolean
  sortOrder: number
}

interface Props {
  serviceId: string
  // locale: string
}

let keyCounter = 0
function nextKey() {
  return `draft-${++keyCounter}`
}

export function DurationOptionsEditor({ serviceId, locale }: Props) {
  const { t } = useLocale()
  const [options, setOptions] = useState<DraftOption[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: existing, isLoading } = useDurationOptions(serviceId)
  const mutation = useDurationOptionsMutation()

  /* Sync server data into local state */
  useEffect(() => {
    if (existing && !dirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions(
        existing.map((o) => ({
          key: o.id,
          label: o.label,
          labelAr: o.labelAr ?? "",
          durationMinutes: o.durationMinutes,
          price: o.price / 100,
          isDefault: o.isDefault,
          sortOrder: o.sortOrder,
        })),
      )
    }
  }, [existing, dirty])

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        key: nextKey(),
        label: "",
        labelAr: "",
        durationMinutes: 30,
        price: 0,
        isDefault: false,
        sortOrder: prev.length,
      },
    ])
    setDirty(true)
  }

  const removeOption = (key: string) => {
    setOptions((prev) => prev.filter((o) => o.key !== key))
    setDirty(true)
  }

  const updateOption = (key: string, field: keyof DraftOption, value: unknown) => {
    setOptions((prev) =>
      prev.map((o) => (o.key === key ? { ...o, [field]: value } : o)),
    )
    setDirty(true)
  }

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({
        serviceId,
        payload: {
          options: options.map((o, i) => ({
            label: o.label,
            labelAr: o.labelAr || undefined,
            durationMinutes: o.durationMinutes,
            price: Math.round(o.price * 100),
            isDefault: o.isDefault,
            sortOrder: i,
          })),
        },
      })
      setDirty(false)
      toast.success(t("services.duration.saved"))
    } catch {
      toast.error(t("services.duration.saveFailed"))
    }
  }

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-sm font-medium text-foreground">{t("services.duration.title")}</p>

      <div className="space-y-4 rounded-lg border border-border p-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            {t("services.duration.loading")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map((opt) => (
            <DurationOptionRow
              key={opt.key}
              option={opt}
              t={t}
              onUpdate={(field, value) => updateOption(opt.key, field, value)}
              onRemove={() => removeOption(opt.key)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addOption}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 me-1" />
          {t("services.duration.addOption")}
        </Button>

        {dirty && (
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={mutation.isPending}
            onClick={handleSave}
          >
            {mutation.isPending
              ? t("services.duration.saving")
              : t("services.duration.save")}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ─── Single Option Row ─── */

function DurationOptionRow({
  option,
  t,
  onUpdate,
  onRemove,
}: {
  option: DraftOption
  t: (key: string) => string
  onUpdate: (field: keyof DraftOption, value: unknown) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {/* Delete button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id={`dur-default-${option.key}`}
            checked={option.isDefault}
            onCheckedChange={(v) => onUpdate("isDefault", v)}
          />
          <Label htmlFor={`dur-default-${option.key}`} className="text-xs cursor-pointer">
            {t("services.duration.default")}
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={t("services.duration.removeOption")}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>

      {/* Duration + Price */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("services.duration.durationMin")}
          </Label>
          <Input
            type="number"
            min={5}
            max={480}
            value={option.durationMinutes}
            onChange={(e) => onUpdate("durationMinutes", Number(e.target.value))}
            className="h-8 text-sm tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("services.duration.priceSAR")}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={option.price}
            onChange={(e) => onUpdate("price", Number(e.target.value))}
            className="h-8 text-sm tabular-nums"
          />
        </div>
      </div>

      {/* Labels */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("services.duration.labelEn")}</Label>
          <Input
            value={option.label}
            onChange={(e) => onUpdate("label", e.target.value)}
            className="h-8 text-sm"
            placeholder={t("services.duration.placeholderEn")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("services.duration.labelAr")}</Label>
          <Input
            value={option.labelAr}
            onChange={(e) => onUpdate("labelAr", e.target.value)}
            className="h-8 text-sm"
            dir="rtl"
            placeholder={t("services.duration.placeholderAr")}
          />
        </div>
      </div>
    </div>
  )
}
