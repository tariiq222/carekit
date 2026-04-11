"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColorSwatchInput } from "@/components/features/shared/color-swatch-input"
import { Separator } from "@/components/ui/separator"
import { useBranding } from "@/components/providers/branding-provider"
import { isValidHex, hexToRgb, contrastRatio, pickForeground } from "@/lib/color-utils"
import { useLocale } from "@/components/locale-provider"
import type { WhiteLabelConfig, UpdateWhitelabelPayload } from "@/lib/types/whitelabel"

function ContrastBadge({ ratio, label }: { ratio: number; label?: string }) {
  const pass = ratio >= 4.5
  const large = ratio >= 3
  const grade = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Fail"
  const color = pass ? "var(--success)" : large ? "var(--warning)" : "var(--error)"
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono tabular-nums"
      style={{ borderColor: color, color }}
      title={label}
    >
      {ratio.toFixed(1)}:1 · {grade}
    </span>
  )
}

interface Props {
  whitelabel: WhiteLabelConfig | null
  onSave: (data: UpdateWhitelabelPayload) => void
  isPending: boolean
}

export function BrandingTab({ whitelabel, onSave, isPending }: Props) {
  const { t } = useLocale()
  const [systemName, setSystemName] = useState("")
  const [systemNameAr, setSystemNameAr] = useState("")
  const [productTagline, setProductTagline] = useState("")
  const [colorPrimary, setColorPrimary] = useState("")
  const [colorPrimaryLight, setColorPrimaryLight] = useState("")
  const [colorPrimaryDark, setColorPrimaryDark] = useState("")
  const [colorAccent, setColorAccent] = useState("")
  const [colorAccentDark, setColorAccentDark] = useState("")
  const [colorBackground, setColorBackground] = useState("")
  const [fontFamily, setFontFamily] = useState("")
  const [fontUrl, setFontUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    if (!whitelabel) return
    setSystemName(whitelabel.systemName ?? "")
    setSystemNameAr(whitelabel.systemNameAr ?? "")
    setProductTagline(whitelabel.productTagline ?? "")
    setColorPrimary(whitelabel.colorPrimary ?? "")
    setColorPrimaryLight(whitelabel.colorPrimaryLight ?? "")
    setColorPrimaryDark(whitelabel.colorPrimaryDark ?? "")
    setColorAccent(whitelabel.colorAccent ?? "")
    setColorAccentDark(whitelabel.colorAccentDark ?? "")
    setColorBackground(whitelabel.colorBackground ?? "")
    setFontFamily(whitelabel.fontFamily ?? "")
    setFontUrl(whitelabel.fontUrl ?? "")
    setLogoUrl(whitelabel.logoUrl ?? "")
    setFaviconUrl(whitelabel.faviconUrl ?? "")
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
    setColorPrimary(value)
    updatePreview(value, colorAccent)
  }

  const handleAccentChange = (value: string) => {
    setColorAccent(value)
    updatePreview(colorPrimary, value)
  }

  useEffect(() => clearPreview, [clearPreview])

  const handleSave = () => {
    onSave({
      systemName,
      systemNameAr,
      productTagline: productTagline || null,
      colorPrimary,
      colorPrimaryLight,
      colorPrimaryDark,
      colorAccent,
      colorAccentDark,
      colorBackground,
      fontFamily,
      fontUrl: fontUrl || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
    })
    if (isValidHex(colorPrimary)) {
      apply({ primary: colorPrimary, accent: isValidHex(colorAccent) ? colorAccent : colorPrimary })
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
          <div className="space-y-2 sm:col-span-2">
            <Label>{"الشعار الفرعي"}</Label>
            <Input value={productTagline} onChange={(e) => setProductTagline(e.target.value)} placeholder="نحو رعاية أفضل" />
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.primaryColor")}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorPrimary) ? colorPrimary : null}
                onChange={handlePrimaryChange}
                defaultColor="#354FD8"
              />
              <Input
                value={colorPrimary}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                placeholder="#354FD8"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{"اللون الأساسي الفاتح"}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorPrimaryLight) ? colorPrimaryLight : null}
                onChange={setColorPrimaryLight}
                defaultColor="#6B7FE3"
              />
              <Input
                value={colorPrimaryLight}
                onChange={(e) => setColorPrimaryLight(e.target.value)}
                placeholder="#6B7FE3"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{"اللون الأساسي الداكن"}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorPrimaryDark) ? colorPrimaryDark : null}
                onChange={setColorPrimaryDark}
                defaultColor="#1E3AB8"
              />
              <Input
                value={colorPrimaryDark}
                onChange={(e) => setColorPrimaryDark(e.target.value)}
                placeholder="#1E3AB8"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.secondaryColor")}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorAccent) ? colorAccent : null}
                onChange={handleAccentChange}
                defaultColor="#82CC17"
              />
              <Input
                value={colorAccent}
                onChange={(e) => handleAccentChange(e.target.value)}
                placeholder="#82CC17"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{"لون التمييز الداكن"}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorAccentDark) ? colorAccentDark : null}
                onChange={setColorAccentDark}
                defaultColor="#5A8F0F"
              />
              <Input
                value={colorAccentDark}
                onChange={(e) => setColorAccentDark(e.target.value)}
                placeholder="#5A8F0F"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{"لون الخلفية"}</Label>
            <div className="flex items-center gap-2">
              <ColorSwatchInput
                value={isValidHex(colorBackground) ? colorBackground : null}
                onChange={setColorBackground}
                defaultColor="#F8F9FF"
              />
              <Input
                value={colorBackground}
                onChange={(e) => setColorBackground(e.target.value)}
                placeholder="#F8F9FF"
                className="font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {isValidHex(colorPrimary) && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                {t("settings.preview") ?? "معاينة"}
              </Label>

              {/* Color swatches row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimary }} title={colorPrimary} />
                {isValidHex(colorPrimaryLight) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimaryLight }} title={colorPrimaryLight} />}
                {isValidHex(colorPrimaryDark) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimaryDark }} title={colorPrimaryDark} />}
                {isValidHex(colorAccent) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorAccent }} title={colorAccent} />}
                {isValidHex(colorAccentDark) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorAccentDark }} title={colorAccentDark} />}
                {isValidHex(colorBackground) && <div className="size-8 rounded-md border shadow-sm ring-1 ring-border" style={{ background: colorBackground }} title={colorBackground} />}
              </div>

              {/* Live UI preview with contrast indicators */}
              <div
                className="rounded-lg border p-4 space-y-3"
                style={{ background: isValidHex(colorBackground) ? colorBackground : "#F2F4F8" }}
              >
                {/* Primary button preview */}
                <div className="flex items-center gap-3">
                  <div
                    className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium shadow-sm"
                    style={{
                      background: colorPrimary,
                      color: pickForeground(colorPrimary),
                    }}
                  >
                    {systemName || "CareKit"}
                  </div>
                  <ContrastBadge ratio={contrastRatio(colorPrimary, isValidHex(colorBackground) ? colorBackground : "#F2F4F8")} />
                </div>

                {/* Accent badge preview */}
                {isValidHex(colorAccent) && (
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                      style={{
                        background: colorAccent,
                        color: pickForeground(colorAccent),
                      }}
                    >
                      Badge
                    </div>
                    <ContrastBadge ratio={contrastRatio(colorAccent, isValidHex(colorBackground) ? colorBackground : "#F2F4F8")} label="Accent على الخلفية" />
                  </div>
                )}

                {/* Foreground text preview */}
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium" style={{ color: "#1B2026" }}>
                    نص أساسي — Primary text
                  </p>
                  <ContrastBadge ratio={contrastRatio("#1B2026", isValidHex(colorBackground) ? colorBackground : "#F2F4F8")} label="نص على الخلفية" />
                </div>
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.fontFamily")}</Label>
            <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="IBM Plex Sans Arabic" />
          </div>
          <div className="space-y-2">
            <Label>{"رابط الخط"}</Label>
            <Input value={fontUrl} onChange={(e) => setFontUrl(e.target.value)} placeholder="https://fonts.googleapis.com/..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.logoUrl")}</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.faviconUrl")}</Label>
            <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
        </div>

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
