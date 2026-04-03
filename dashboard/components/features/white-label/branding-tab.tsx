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
  const [systemName, setSystemName] = useState("")
  const [systemNameAr, setSystemNameAr] = useState("")
  const [primaryColor, setPrimaryColor] = useState("")
  const [accentColor, setAccentColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [fontFamily, setFontFamily] = useState("")
  const [twitter, setTwitter] = useState("")
  const [instagram, setInstagram] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [linkedin, setLinkedin] = useState("")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemName(configMap.system_name ?? "")
    setSystemNameAr(configMap.system_name_ar ?? "")
    setPrimaryColor(configMap.primary_color ?? "")
    setAccentColor(configMap.secondary_color ?? "")
    setLogoUrl(configMap.logo_url ?? "")
    setFaviconUrl(configMap.favicon_url ?? "")
    setFontFamily(configMap.font_family ?? "")
    setTwitter(configMap.social_twitter ?? "")
    setInstagram(configMap.social_instagram ?? "")
    setWhatsapp(configMap.social_whatsapp ?? "")
    setLinkedin(configMap.social_linkedin ?? "")
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
      { key: "system_name", value: systemName },
      { key: "system_name_ar", value: systemNameAr },
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.tabs.branding")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("whiteLabel.systemName")}</Label>
              <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} dir="ltr" placeholder="CareKit Clinic" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.systemNameAr")}</Label>
              <Input value={systemNameAr} onChange={(e) => setSystemNameAr(e.target.value)} dir="rtl" placeholder="عيادة كيركت" />
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

      {/* Social Media Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("whiteLabel.social")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("whiteLabel.twitter")}</Label>
              <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/..." dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.instagram")}</Label>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.whatsapp")}</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+966..." dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.linkedin")}</Label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/..." dir="ltr" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={isPending} onClick={() => onSave([
              { key: "social_twitter", value: twitter },
              { key: "social_instagram", value: instagram },
              { key: "social_whatsapp", value: whatsapp },
              { key: "social_linkedin", value: linkedin },
            ])}>
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
