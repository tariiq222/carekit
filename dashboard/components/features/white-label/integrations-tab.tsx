"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function IntegrationsTab({ configMap, onSave, isPending, t }: Props) {
  const [zoomClientId, setZoomClientId] = useState("")
  const [zoomClientSecret, setZoomClientSecret] = useState("")
  const [zoomAccountId, setZoomAccountId] = useState("")
  const [zoomEnabled, setZoomEnabled] = useState(false)
  const [emailProvider, setEmailProvider] = useState("")
  const [emailApiKey, setEmailApiKey] = useState("")
  const [emailFrom, setEmailFrom] = useState("")

  useEffect(() => {
    setZoomClientId(configMap.zoom_client_id ?? "")
    setZoomClientSecret(configMap.zoom_client_secret ?? "")
    setZoomAccountId(configMap.zoom_account_id ?? "")
    setZoomEnabled(configMap.zoom_enabled === "true")
    setEmailProvider(configMap.email_provider ?? "")
    setEmailApiKey(configMap.email_api_key ?? "")
    setEmailFrom(configMap.email_from ?? "")
  }, [configMap])

  return (
    <div className="flex flex-col gap-6">
      {/* Zoom */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t("settings.zoom")}</CardTitle>
              <CardDescription>{t("settings.zoomDesc")}</CardDescription>
            </div>
            <Switch checked={zoomEnabled} onCheckedChange={setZoomEnabled} />
          </div>
        </CardHeader>
        {zoomEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("settings.zoomClientId")}</Label>
                <Input value={zoomClientId} onChange={(e) => setZoomClientId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.zoomClientSecret")}</Label>
                <Input value={zoomClientSecret} onChange={(e) => setZoomClientSecret(e.target.value)} type="password" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("settings.zoomAccountId")}</Label>
                <Input value={zoomAccountId} onChange={(e) => setZoomAccountId(e.target.value)} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.email")}</CardTitle>
          <CardDescription>{t("settings.emailDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.emailProvider")}</Label>
              <Input value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)} placeholder="resend / sendgrid" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.emailApiKey")}</Label>
              <Input value={emailApiKey} onChange={(e) => setEmailApiKey(e.target.value)} type="password" placeholder="re_..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("settings.emailFrom")}</Label>
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="noreply@clinic.com" type="email" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            onSave([
              { key: "zoom_client_id", value: zoomClientId },
              { key: "zoom_client_secret", value: zoomClientSecret },
              { key: "zoom_account_id", value: zoomAccountId },
              { key: "zoom_enabled", value: String(zoomEnabled), type: "boolean" },
              { key: "email_provider", value: emailProvider },
              { key: "email_api_key", value: emailApiKey },
              { key: "email_from", value: emailFrom },
            ])
          }
        >
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
