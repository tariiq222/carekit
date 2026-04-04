"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function TechnicalTab({ configMap, onSave, isPending, t }: Props) {
  const [moyasarKey, setMoyasarKey] = useState("")
  const [moyasarSecret, setMoyasarSecret] = useState("")
  const [zoomClientId, setZoomClientId] = useState("")
  const [zoomClientSecret, setZoomClientSecret] = useState("")
  const [zoomAccountId, setZoomAccountId] = useState("")
  const [emailProvider, setEmailProvider] = useState("")
  const [emailApiKey, setEmailApiKey] = useState("")
  const [emailFrom, setEmailFrom] = useState("")
  const [firebaseConfig, setFirebaseConfig] = useState("")
  const [openrouterKey, setOpenrouterKey] = useState("")

  useEffect(() => {
    setMoyasarKey(configMap.moyasar_publishable_key ?? "")
    setMoyasarSecret(configMap.moyasar_secret_key ?? "")
    setZoomClientId(configMap.zoom_client_id ?? "")
    setZoomClientSecret(configMap.zoom_client_secret ?? "")
    setZoomAccountId(configMap.zoom_account_id ?? "")
    setEmailProvider(configMap.email_provider ?? "")
    setEmailApiKey(configMap.email_api_key ?? "")
    setEmailFrom(configMap.email_from ?? "")
    setFirebaseConfig(configMap.firebase_config ?? "")
    setOpenrouterKey(configMap.openrouter_api_key ?? "")
  }, [configMap])

  const handleSave = () => onSave([
    { key: "moyasar_publishable_key", value: moyasarKey },
    { key: "moyasar_secret_key", value: moyasarSecret },
    { key: "zoom_client_id", value: zoomClientId },
    { key: "zoom_client_secret", value: zoomClientSecret },
    { key: "zoom_account_id", value: zoomAccountId },
    { key: "email_provider", value: emailProvider },
    { key: "email_api_key", value: emailApiKey },
    { key: "email_from", value: emailFrom },
    { key: "firebase_config", value: firebaseConfig, type: "json" },
    { key: "openrouter_api_key", value: openrouterKey },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3">
        <HugeiconsIcon icon={Alert01Icon} size={18} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-sm text-warning">{t("whiteLabel.technicalWarning")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Moyasar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.moyasar")}</CardTitle>
            <CardDescription>{t("settings.moyasarDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.moyasarKey")}</Label>
              <Input value={moyasarKey} onChange={(e) => setMoyasarKey(e.target.value)} placeholder="pk_live_..." type="password" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.moyasarSecret")}</Label>
              <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder="sk_live_..." type="password" dir="ltr" />
            </div>
          </CardContent>
        </Card>

        {/* Zoom */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.zoom")}</CardTitle>
            <CardDescription>{t("settings.zoomDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.zoomClientId")}</Label>
              <Input value={zoomClientId} onChange={(e) => setZoomClientId(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.zoomClientSecret")}</Label>
              <Input value={zoomClientSecret} onChange={(e) => setZoomClientSecret(e.target.value)} type="password" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.zoomAccountId")}</Label>
              <Input value={zoomAccountId} onChange={(e) => setZoomAccountId(e.target.value)} dir="ltr" />
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.email")}</CardTitle>
            <CardDescription>{t("settings.emailDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.emailProvider")}</Label>
              <Input value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)} placeholder="resend / sendgrid" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.emailApiKey")}</Label>
              <Input value={emailApiKey} onChange={(e) => setEmailApiKey(e.target.value)} type="password" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.emailFrom")}</Label>
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} type="email" dir="ltr" />
            </div>
          </CardContent>
        </Card>

        {/* AI */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("whiteLabel.openrouter")}</CardTitle>
            <CardDescription>{t("whiteLabel.openrouterDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("whiteLabel.openrouterKey")}</Label>
              <Input value={openrouterKey} onChange={(e) => setOpenrouterKey(e.target.value)} type="password" dir="ltr" placeholder="sk-or-..." />
            </div>
          </CardContent>
        </Card>

        {/* Firebase */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{t("whiteLabel.firebase")}</CardTitle>
            <CardDescription>{t("whiteLabel.firebaseDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={firebaseConfig}
              onChange={(e) => setFirebaseConfig(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              dir="ltr"
              placeholder='{"apiKey": "...", "projectId": "..."}'
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={isPending} onClick={handleSave}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
