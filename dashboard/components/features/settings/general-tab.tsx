"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

const WEEK_START_OPTIONS = [
  { value: "sunday", label: "الأحد (Sunday)" },
  { value: "monday", label: "الاثنين (Monday)" },
]

const DATE_FORMAT_OPTIONS = [
  { value: "Y-m-d", label: "2026-03-24 (Y-m-d)" },
  { value: "d/m/Y", label: "24/03/2026 (d/m/Y)" },
  { value: "m/d/Y", label: "03/24/2026 (m/d/Y)" },
]

const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24 ساعة (24h)" },
  { value: "12h", label: "12 ساعة (12h)" },
]

const TIMEZONE_OPTIONS = [
  { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (UTC+3)" },
  { value: "Asia/Bahrain", label: "Asia/Bahrain (UTC+3)" },
  { value: "Asia/Qatar", label: "Asia/Qatar (UTC+3)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (UTC+2)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
  { value: "America/New_York", label: "America/New_York (UTC-5)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (UTC+3)" },
  { value: "Asia/Amman", label: "Asia/Amman (UTC+3)" },
  { value: "Asia/Beirut", label: "Asia/Beirut (UTC+2)" },
  { value: "Asia/Baghdad", label: "Asia/Baghdad (UTC+3)" },
]

export function GeneralTab({ configMap, onSave, isPending, t }: Props) {
  const [clinicName, setClinicName] = useState("")
  const [clinicEmail, setClinicEmail] = useState("")
  const [clinicPhone, setClinicPhone] = useState("")
  const [clinicDomain, setClinicDomain] = useState("")
  const [clinicAddress, setClinicAddress] = useState("")
  const [clinicCr, setClinicCr] = useState("")
  const [clinicVat, setClinicVat] = useState("")
  const [weekStartDay, setWeekStartDay] = useState("sunday")
  const [dateFormat, setDateFormat] = useState("Y-m-d")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [clinicTimezone, setClinicTimezone] = useState("Asia/Riyadh")

  useEffect(() => {
    setClinicName(configMap.clinic_name ?? "")
    setClinicEmail(configMap.clinic_email ?? "")
    setClinicPhone(configMap.clinic_phone ?? "")
    setClinicDomain(configMap.clinic_domain ?? "")
    setClinicAddress(configMap.clinic_address ?? "")
    setClinicCr(configMap.clinic_cr_number ?? "")
    setClinicVat(configMap.clinic_vat_number ?? "")
    setWeekStartDay(configMap.week_start_day ?? "sunday")
    setDateFormat(configMap.date_format ?? "Y-m-d")
    setTimeFormat(configMap.time_format ?? "24h")
    setClinicTimezone(configMap.clinic_timezone ?? "Asia/Riyadh")
  }, [configMap])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tabs.general")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.clinicName")} value={clinicName} onChange={setClinicName} />
          <Field label={t("settings.clinicEmail")} value={clinicEmail} onChange={setClinicEmail} type="email" />
          <Field label={t("settings.clinicPhone")} value={clinicPhone} onChange={setClinicPhone} />
          <Field label={t("settings.clinicDomain")} value={clinicDomain} onChange={setClinicDomain} />
          <Field label={t("settings.clinicAddress")} value={clinicAddress} onChange={setClinicAddress} />
          <Field label={t("settings.clinicCr")} value={clinicCr} onChange={setClinicCr} />
          <Field label={t("settings.clinicVat")} value={clinicVat} onChange={setClinicVat} />
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("settings.regionalSettings")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("settings.weekStartDay")}
              value={weekStartDay}
              onChange={setWeekStartDay}
              options={WEEK_START_OPTIONS}
            />
            <SelectField
              label={t("settings.dateFormat")}
              value={dateFormat}
              onChange={setDateFormat}
              options={DATE_FORMAT_OPTIONS}
            />
            <SelectField
              label={t("settings.timeFormat")}
              value={timeFormat}
              onChange={setTimeFormat}
              options={TIME_FORMAT_OPTIONS}
            />
            <SelectField
              label={t("settings.clinicTimezone")}
              value={clinicTimezone}
              onChange={setClinicTimezone}
              options={TIMEZONE_OPTIONS}
            />
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              onSave([
                { key: "clinic_name", value: clinicName },
                { key: "clinic_email", value: clinicEmail },
                { key: "clinic_phone", value: clinicPhone },
                { key: "clinic_domain", value: clinicDomain },
                { key: "clinic_address", value: clinicAddress },
                { key: "clinic_cr_number", value: clinicCr },
                { key: "clinic_vat_number", value: clinicVat },
                { key: "week_start_day", value: weekStartDay },
                { key: "date_format", value: dateFormat },
                { key: "time_format", value: timeFormat },
                { key: "clinic_timezone", value: clinicTimezone },
              ])
            }
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
