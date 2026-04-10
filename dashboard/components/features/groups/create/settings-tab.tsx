"use client"

import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DateTimeInput } from "@/components/ui/date-time-input"
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
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"

/* ─── Props ─── */

interface SettingsTabProps {
  form: UseFormReturn<CreateGroupFormValues>
}

/* ─── Component ─── */

export function SettingsTab({ form }: SettingsTabProps) {
  const { t } = useLocale()

  const deliveryMode = form.watch("deliveryMode")
  const isPublished = form.watch("isPublished") ?? false

  return (
    <Card className="border-s-2 border-s-primary/40">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{t("groups.create.tabs.settings")}</CardTitle>
          <CardDescription>{t("groups.create.tabs.settings")}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* ── Delivery Mode ── */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.deliveryMode")} *</Label>
          <Select
            value={deliveryMode}
            onValueChange={(v) =>
              form.setValue("deliveryMode", v as CreateGroupFormValues["deliveryMode"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_person">
                {t("groups.create.deliveryMode.in_person")}
              </SelectItem>
              <SelectItem value="online">
                {t("groups.create.deliveryMode.online")}
              </SelectItem>
              <SelectItem value="hybrid">
                {t("groups.create.deliveryMode.hybrid")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Location (conditional NOT online) ── */}
        {deliveryMode !== "online" && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.location")}</Label>
            <Input {...form.register("location")} />
          </div>
        )}

        {/* ── Meeting Link (conditional NOT in_person) ── */}
        {deliveryMode !== "in_person" && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.meetingLink")}</Label>
            <Input {...form.register("meetingLink")} />
          </div>
        )}

        {/* ── Published ── */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <Label htmlFor="group-published" className="cursor-pointer text-sm">
            {t("groups.create.isPublished")}
          </Label>
          <Switch
            id="group-published"
            checked={isPublished}
            onCheckedChange={(v) => form.setValue("isPublished", v)}
          />
        </div>

        {/* ── Expires At ── */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.expiresAt")}</Label>
          <Controller
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <DateTimeInput
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

      </CardContent>
    </Card>
  )
}
