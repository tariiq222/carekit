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
import { useLocale } from "@/components/locale-provider"
import type { WhiteLabelConfig, UpdateWhitelabelPayload } from "@/lib/types/whitelabel"

interface Props {
  whitelabel: WhiteLabelConfig | null
  onSave: (data: UpdateWhitelabelPayload) => void
  isPending: boolean
}

export function BrandingTab({ whitelabel, onSave, isPending }: Props) {
  const { t } = useLocale()
  const [systemName, setSystemName] = useState("")
  const [systemNameAr, setSystemNameAr] = useState("")
  const [primaryColor, setPrimaryColor] = useState("")
  const [secondaryColor, setSecondaryColor] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [fontFamily, setFontFamily] = useState("")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    if (!whitelabel) return
    setSystemName(whitelabel.systemName ?? "")
    setSystemNameAr(whitelabel.systemNameAr ?? "")
    setPrimaryColor(whitelabel.primaryColor ?? "")
    setSecondaryColor(whitelabel.secondaryColor ?? "")
    setLogoUrl(whitelabel.logoUrl ?? "")
    setFaviconUrl(whitelabel.faviconUrl ?? "")
    setFontFamily(whitelabel.fontFamily ?? "")
  }, [whitelabel])

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
    updatePreview(value, secondaryColor)
  }

  const handleSecondaryChange = (value: string) => {
    setSecondaryColor(value)
    updatePreview(primaryColor, value)
  }

  useEffect(() => clearPreview, [clearPreview])

  const handleSave = () => {
    onSave({
      systemName,
      systemNameAr,
      primaryColor,
      secondaryColor,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      fontFamily,
    })
    if (isValidHex(primaryColor)) {
      apply({
        primary: primaryColor,
        accent: isValidHex(secondaryColor) ? secondaryColor : primaryColor,
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

          <div className="space-y-2">
            <Label>{t("settings.secondaryColor")}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(secondaryColor) ? secondaryColor : null}
                onChange={handleSecondaryChange}
                defaultColor="#82CC17"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => handleSecondaryChange(e.target.value)}
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
                {isValidHex(secondaryColor) && (
                  <div
                    className="size-10 rounded-lg shadow-sm"
                    style={{ background: secondaryColor }}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {primaryColor}
                  {isValidHex(secondaryColor) ? ` / ${secondaryColor}` : ""}
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
