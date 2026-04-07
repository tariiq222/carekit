"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ColorSwatchInput } from "@/components/features/shared/color-swatch-input"
import { useBranding } from "@/components/providers/branding-provider"
import { isValidHex } from "@/lib/color-utils"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

type TabId = "identity" | "colors"

export function BrandingTab({ configMap, onSave, isPending, t }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("identity")

  const [appName, setAppName] = useState("")
  const [primaryColor, setPrimaryColor] = useState("")
  const [accentColor, setAccentColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [fontFamily, setFontFamily] = useState("")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppName(configMap.app_name ?? "")
    setPrimaryColor(configMap.primary_color ?? "")
    setAccentColor(configMap.secondary_color ?? "")
    setLogoUrl(configMap.logo_url ?? "")
    setFaviconUrl(configMap.favicon_url ?? "")
    setFontFamily(configMap.font_family ?? "")
  }, [configMap])

  const updatePreview = useCallback(
    (primary: string, accent: string) => {
      if (isValidHex(primary)) {
        preview({ primary, accent: isValidHex(accent) ? accent : primary })
      }
    },
    [preview],
  )

  const handlePrimaryChange = (value: string) => {
    setPrimaryColor(value)
    updatePreview(value, accentColor)
  }

  const handleAccentChange = (value: string) => {
    setAccentColor(value)
    updatePreview(primaryColor, value)
  }

  useEffect(() => clearPreview, [clearPreview])

  const handleSave = () => {
    onSave([
      { key: "app_name", value: appName },
      { key: "primary_color", value: primaryColor },
      { key: "secondary_color", value: accentColor },
      { key: "logo_url", value: logoUrl },
      { key: "favicon_url", value: faviconUrl },
      { key: "font_family", value: fontFamily },
    ])
    if (isValidHex(primaryColor)) {
      apply({ primary: primaryColor, accent: isValidHex(accentColor) ? accentColor : primaryColor })
    }
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "identity", label: t("settings.tabs.branding"), desc: t("settings.appName") },
    { id: "colors", label: t("settings.primaryColor"), desc: t("settings.secondaryColor") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.tabs.branding")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <p className="text-sm font-medium truncate leading-tight">{tab.label}</p>
                {activeTab === tab.id && (
                  <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">{tab.desc}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {activeTab === "identity" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.appName")}</Label>
                    <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.fontFamily")}</Label>
                    <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="IBM Plex Sans Arabic" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.logoUrl")}</Label>
                    <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.faviconUrl")}</Label>
                    <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." />
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isPending} onClick={handleSave}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "colors" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.primaryColor")}</Label>
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={isValidHex(primaryColor) ? primaryColor : null}
                        onChange={handlePrimaryChange}
                        defaultColor="#354FD8"
                      />
                      <Input value={primaryColor} onChange={(e) => handlePrimaryChange(e.target.value)}
                        placeholder="#354FD8" className="font-mono tabular-nums" dir="ltr" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.secondaryColor")}</Label>
                    <div className="flex items-center gap-2">
                      <ColorSwatchInput
                        value={isValidHex(accentColor) ? accentColor : null}
                        onChange={handleAccentChange}
                        defaultColor="#82CC17"
                      />
                      <Input value={accentColor} onChange={(e) => handleAccentChange(e.target.value)}
                        placeholder="#82CC17" className="font-mono tabular-nums" dir="ltr" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview Swatch */}
              {isValidHex(primaryColor) && (
                <Card className="shadow-sm bg-surface">
                  <CardContent className="pt-3 pb-3">
                    <Separator className="mb-3" />
                    <Label className="text-xs text-muted-foreground block mb-2">
                      {t("settings.preview") ?? "Preview"}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg shadow-sm" style={{ background: primaryColor }} />
                      {isValidHex(accentColor) && (
                        <div className="size-10 rounded-lg shadow-sm" style={{ background: accentColor }} />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {primaryColor}{isValidHex(accentColor) ? ` / ${accentColor}` : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isPending} onClick={handleSave}>
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
