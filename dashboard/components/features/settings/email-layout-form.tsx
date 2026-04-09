"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfigMap, useUpdateConfig } from "@/hooks/use-whitelabel"
import { useLocale } from "@/components/locale-provider"

const EMAIL_LAYOUT_KEYS = [
  "email_header_show_logo",
  "email_header_show_name",
  "email_footer_phone",
  "email_footer_website",
  "email_footer_instagram",
  "email_footer_twitter",
  "email_footer_snapchat",
  "email_footer_tiktok",
  "email_footer_linkedin",
  "email_footer_youtube",
] as const

type LayoutKey = (typeof EMAIL_LAYOUT_KEYS)[number]

interface LayoutState {
  email_header_show_logo: boolean
  email_header_show_name: boolean
  email_footer_phone: string
  email_footer_website: string
  email_footer_instagram: string
  email_footer_twitter: string
  email_footer_snapchat: string
  email_footer_tiktok: string
  email_footer_linkedin: string
  email_footer_youtube: string
}

const DEFAULTS: LayoutState = {
  email_header_show_logo: true,
  email_header_show_name: true,
  email_footer_phone: "",
  email_footer_website: "",
  email_footer_instagram: "",
  email_footer_twitter: "",
  email_footer_snapchat: "",
  email_footer_tiktok: "",
  email_footer_linkedin: "",
  email_footer_youtube: "",
}

function parseConfigMap(configMap: Record<string, string | undefined>): LayoutState {
  return {
    email_header_show_logo: configMap.email_header_show_logo !== "false",
    email_header_show_name: configMap.email_header_show_name !== "false",
    email_footer_phone: configMap.email_footer_phone ?? "",
    email_footer_website: configMap.email_footer_website ?? "",
    email_footer_instagram: configMap.email_footer_instagram ?? "",
    email_footer_twitter: configMap.email_footer_twitter ?? "",
    email_footer_snapchat: configMap.email_footer_snapchat ?? "",
    email_footer_tiktok: configMap.email_footer_tiktok ?? "",
    email_footer_linkedin: configMap.email_footer_linkedin ?? "",
    email_footer_youtube: configMap.email_footer_youtube ?? "",
  }
}

/* ─── Social Field ─── */

function SocialField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-28 text-sm shrink-0">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="flex-1"
      />
    </div>
  )
}

/* ─── Main Form ─── */

export function EmailLayoutForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useLocale()
  const { data: configMap, isLoading } = useConfigMap()
  const updateConfig = useUpdateConfig()

  const [state, setState] = useState<LayoutState>(DEFAULTS)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (configMap && !initialized) {
      setState(parseConfigMap(configMap))
      setInitialized(true)
    }
  }, [configMap, initialized])

  const setField = <K extends LayoutKey>(key: K, value: LayoutState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const configs = EMAIL_LAYOUT_KEYS.map((key) => ({
      key,
      value: String(state[key]),
      type: "string" as const,
    }))

    updateConfig.mutate(
      { configs },
      {
        onSuccess: () => toast.success(t("settings.emailLayout.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <p className="text-sm font-semibold text-foreground">
        {t("settings.emailLayout.title")}
      </p>
      <p className="text-xs text-muted-foreground -mt-2">
        {t("settings.emailLayout.description")}
      </p>

      {/* Header Section */}
      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-4 pb-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("settings.emailLayout.header")}
          </p>
          <div className="flex items-center justify-between">
            <Label>{t("settings.emailLayout.showLogo")}</Label>
            <Switch
              checked={state.email_header_show_logo}
              onCheckedChange={(v) => setField("email_header_show_logo", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("settings.emailLayout.showName")}</Label>
            <Switch
              checked={state.email_header_show_name}
              onCheckedChange={(v) => setField("email_header_show_name", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer Section */}
      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-4 pb-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("settings.emailLayout.footer")}
          </p>
          <SocialField
            label={t("settings.emailLayout.phone")}
            value={state.email_footer_phone}
            onChange={(v) => setField("email_footer_phone", v)}
            placeholder="+966500000000"
          />
          <SocialField
            label={t("settings.emailLayout.website")}
            value={state.email_footer_website}
            onChange={(v) => setField("email_footer_website", v)}
            placeholder="https://clinic.com"
          />
          <SocialField
            label={t("settings.emailLayout.instagram")}
            value={state.email_footer_instagram}
            onChange={(v) => setField("email_footer_instagram", v)}
            placeholder="https://instagram.com/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.twitter")}
            value={state.email_footer_twitter}
            onChange={(v) => setField("email_footer_twitter", v)}
            placeholder="https://x.com/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.snapchat")}
            value={state.email_footer_snapchat}
            onChange={(v) => setField("email_footer_snapchat", v)}
            placeholder="https://snapchat.com/add/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.tiktok")}
            value={state.email_footer_tiktok}
            onChange={(v) => setField("email_footer_tiktok", v)}
            placeholder="https://tiktok.com/@clinic"
          />
          <SocialField
            label={t("settings.emailLayout.linkedin")}
            value={state.email_footer_linkedin}
            onChange={(v) => setField("email_footer_linkedin", v)}
            placeholder="https://linkedin.com/company/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.youtube")}
            value={state.email_footer_youtube}
            onChange={(v) => setField("email_footer_youtube", v)}
            placeholder="https://youtube.com/@clinic"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
