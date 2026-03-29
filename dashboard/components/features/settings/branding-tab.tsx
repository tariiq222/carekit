"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColorSwatchInput } from "@/components/features/shared/color-swatch-input"
import { Separator } from "@/components/ui/separator"
import { useBranding } from "@/components/providers/branding-provider"
import { isValidHex } from "@/lib/color-utils"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function BrandingTab({ configMap, onSave, isPending, t }: Props) {
  const [appName, setAppName] = useState("")
  const [primaryColor, setPrimaryColor] = useState("")
  const [accentColor, setAccentColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [fontFamily, setFontFamily] = useState("")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    setAppName(configMap.app_name ?? "")
    setPrimaryColor(configMap.primary_color ?? "")
    setAccentColor(configMap.secondary_color ?? "")
    setLogoUrl(configMap.logo_url ?? "")
    setFaviconUrl(configMap.favicon_url ?? "")
    setFontFamily(configMap.font_family ?? "")
  }, [configMap])

  /* Live preview on color change */
  const updatePreview = useCallback(
    (primary: string, accent: string) => {
      if (isValidHex(primary)) {
        preview({
          primary,
          accent: isValidHex(accent) ? accent : primary,
        })
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

  /* Revert preview on unmount */
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
    /* Persist to branding provider */
    if (isValidHex(primaryColor)) {
      apply({
        primary: primaryColor,
        accent: isValidHex(accentColor) ? accentColor : primaryColor,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tabs.branding")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.appName")}</Label>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.fontFamily")}</Label>
            <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="IBM Plex Sans Arabic" />
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label>{t("settings.primaryColor")}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(primaryColor) ? primaryColor : null}
                onChange={handlePrimaryChange}
                defaultColor="#354FD8"
              />
              <Input
                value={primaryColor}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                placeholder="#354FD8"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-2">
            <Label>{t("settings.secondaryColor")}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(accentColor) ? accentColor : null}
                onChange={handleAccentChange}
                defaultColor="#82CC17"
              />
              <Input
                value={accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
                placeholder="#82CC17"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.logoUrl")}</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.faviconUrl")}</Label>
            <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {/* Live Preview Swatch */}
        {isValidHex(primaryColor) && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {t("settings.preview") ?? "Preview"}
              </Label>
              <div className="flex items-center gap-3">
                <div
                  className="size-10 rounded-lg shadow-sm"
                  style={{ background: primaryColor }}
                />
                {isValidHex(accentColor) && (
                  <div
                    className="size-10 rounded-lg shadow-sm"
                    style={{ background: accentColor }}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {primaryColor}
                  {isValidHex(accentColor) ? ` / ${accentColor}` : ""}
                </span>
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
