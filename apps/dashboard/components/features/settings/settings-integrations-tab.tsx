"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useOrganizationIntegrations, useUpdateOrganizationIntegrations } from "@/hooks/use-organization-integrations"
import { ZoomSettingsForm } from "@/components/features/zoom/zoom-settings-form"
import { useZoomConfig } from "@/hooks/use-zoom-config"
import { useLocale } from "@/components/locale-provider"

type TabId = "zoom" | "email"

export function SettingsIntegrationsTab() {
  const { t } = useLocale()
  const { data: integrations, isLoading } = useOrganizationIntegrations()
  const updateIntegrations = useUpdateOrganizationIntegrations()
  const { config: zoomConfig } = useZoomConfig()

  const [activeTab, setActiveTab] = useState<TabId>("zoom")

  const [emailProvider, setEmailProvider] = useState("")
  const [emailApiKey, setEmailApiKey] = useState("")
  const [emailFrom, setEmailFrom] = useState("")

  useEffect(() => {
    if (!integrations) return
    // Seed editable form fields from async-loaded integrations; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmailProvider(integrations.emailProvider ?? "")
    setEmailApiKey(integrations.emailApiKey ?? "")
    setEmailFrom(integrations.emailFrom ?? "")
  }, [integrations])

  const handleSaveEmail = () => {
    const payload: Record<string, string | null> = {
      emailProvider,
      emailFrom,
    }
    if (emailApiKey && emailApiKey !== "***") {
      payload.emailApiKey = emailApiKey
    }
    updateIntegrations.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
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
  }[] = [
    { id: "zoom", label: t("settings.zoom"), desc: t("settings.zoomDesc") },
    { id: "email", label: t("settings.email"), desc: t("settings.emailDesc") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
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

                {tab.id === "zoom" && zoomConfig?.configured && (
                  <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-success/10 text-success border border-success/30 text-[10px] px-2 py-0.5">
                    {t("zoom.form.configured")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6">
          {activeTab === "zoom" && <ZoomSettingsForm />}

          {activeTab === "email" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.emailProvider")}</Label>
                    <Input value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)} placeholder="resend / sendgrid" dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.emailApiKey")}</Label>
                    <Input value={emailApiKey} onChange={(e) => setEmailApiKey(e.target.value)} type="password"
                      placeholder={emailApiKey === "***" ? "............" : "re_..."} dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.emailFrom")}</Label>
                    <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="noreply@clinic.com" type="email" dir="ltr" />
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={updateIntegrations.isPending} onClick={handleSaveEmail}>
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
