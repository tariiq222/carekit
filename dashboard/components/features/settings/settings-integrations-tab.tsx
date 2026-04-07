"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useConfigMap, useUpdateConfig } from "@/hooks/use-whitelabel"
import { useLocale } from "@/components/locale-provider"

type TabId = "zoom" | "email"

export function SettingsIntegrationsTab() {
  const { t } = useLocale()
  const { data: configMap, isLoading } = useConfigMap()
  const updateConfig = useUpdateConfig()

  const [activeTab, setActiveTab] = useState<TabId>("zoom")

  const [zoomEnabled, setZoomEnabled] = useState(false)
  const [zoomClientId, setZoomClientId] = useState("")
  const [zoomClientSecret, setZoomClientSecret] = useState("")
  const [zoomAccountId, setZoomAccountId] = useState("")

  const [emailProvider, setEmailProvider] = useState("")
  const [emailApiKey, setEmailApiKey] = useState("")
  const [emailFrom, setEmailFrom] = useState("")

  useEffect(() => {
    if (!configMap) return
    setZoomEnabled(configMap.zoom_enabled === "true")
    setZoomClientId(configMap.zoom_client_id ?? "")
    setZoomClientSecret(configMap.zoom_client_secret ?? "")
    setZoomAccountId(configMap.zoom_account_id ?? "")
    setEmailProvider(configMap.email_provider ?? "")
    setEmailApiKey(configMap.email_api_key ?? "")
    setEmailFrom(configMap.email_from ?? "")
  }, [configMap])

  const handleSaveZoom = () => {
    updateConfig.mutate(
      {
        configs: [
          { key: "zoom_enabled", value: String(zoomEnabled), type: "boolean" as const },
          { key: "zoom_client_id", value: zoomClientId },
          { key: "zoom_client_secret", value: zoomClientSecret },
          { key: "zoom_account_id", value: zoomAccountId },
        ],
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handleSaveEmail = () => {
    updateConfig.mutate(
      {
        configs: [
          { key: "email_provider", value: emailProvider },
          { key: "email_api_key", value: emailApiKey },
          { key: "email_from", value: emailFrom },
        ],
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  const tabs: {
    id: TabId
    label: string
    desc: string
    enabled: boolean
    onToggle: (v: boolean) => void
  }[] = [
    {
      id: "zoom",
      label: t("settings.zoom"),
      desc: t("settings.zoomDesc"),
      enabled: zoomEnabled,
      onToggle: setZoomEnabled,
    },
    {
      id: "email",
      label: t("settings.email"),
      desc: t("settings.emailDesc"),
      enabled: true,
      onToggle: () => {},
    },
  ]

  const activeTabDef = tabs.find((tab) => tab.id === activeTab)!

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">

        {/* ── Sidebar Tabs ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("settings.integrations.title")}
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id)
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-3 cursor-pointer select-none transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {/* Label */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {tab.label}
                  </p>
                  {activeTab === tab.id && (
                    <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">
                      {tab.desc}
                    </p>
                  )}
                </div>

                {/* Switch — only for toggleable integrations */}
                {tab.id === "zoom" && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <Switch
                      checked={tab.enabled}
                      onCheckedChange={tab.onToggle}
                      disabled={updateConfig.isPending}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content Panel ── */}
        <div className="flex-1 p-6">

          {/* Zoom Panel */}
          {activeTab === "zoom" && (
            !zoomEnabled ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-surface-muted flex items-center justify-center border border-border">
                  <Switch checked={false} disabled className="scale-75 pointer-events-none" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t("settings.zoom")}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {t("settings.zoomDesc")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomEnabled(true)}
                  disabled={updateConfig.isPending}
                >
                  {t("settings.payment.enable")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div>
                  <p className="text-sm font-semibold">{t("settings.zoom")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("settings.zoomDesc")}</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>{t("settings.zoomClientId")}</Label>
                  <Input
                    value={zoomClientId}
                    onChange={(e) => setZoomClientId(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.zoomClientSecret")}</Label>
                  <Input
                    value={zoomClientSecret}
                    onChange={(e) => setZoomClientSecret(e.target.value)}
                    type="password"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.zoomAccountId")}</Label>
                  <Input
                    value={zoomAccountId}
                    onChange={(e) => setZoomAccountId(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" disabled={updateConfig.isPending} onClick={handleSaveZoom}>
                    {t("settings.save")}
                  </Button>
                </div>
              </div>
            )
          )}

          {/* Email Panel */}
          {activeTab === "email" && (
            <div className="space-y-4 max-w-md">
              <div>
                <p className="text-sm font-semibold">{t("settings.email")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.emailDesc")}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t("settings.emailProvider")}</Label>
                <Input
                  value={emailProvider}
                  onChange={(e) => setEmailProvider(e.target.value)}
                  placeholder="resend / sendgrid"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.emailApiKey")}</Label>
                <Input
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                  type="password"
                  placeholder="re_..."
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.emailFrom")}</Label>
                <Input
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                  placeholder="noreply@clinic.com"
                  type="email"
                  dir="ltr"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" disabled={updateConfig.isPending} onClick={handleSaveEmail}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </Card>
  )
}
