"use client"

/**
 * Widget Tab — Booking widget embed instructions & configuration
 * Shows the embed snippet, URL parameters, and a live preview link.
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  CheckmarkCircle01Icon,
  LinkSquare01Icon,
  CodeSquareIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ─── Types ─── */

interface Props {
  t: (key: string) => string
}

/* ─── Helpers ─── */

const DASHBOARD_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://dashboard.carekit.app"

function buildWidgetUrl(params: {
  practitioner?: string
  service?: string
  locale: string
  origin: string
}) {
  const url = new URL(`${DASHBOARD_ORIGIN}/booking`)
  if (params.practitioner) url.searchParams.set("practitioner", params.practitioner)
  if (params.service) url.searchParams.set("service", params.service)
  url.searchParams.set("locale", params.locale)
  if (params.origin) url.searchParams.set("origin", params.origin)
  return url.toString()
}

function buildIframeSnippet(widgetUrl: string) {
  return `<iframe
  src="${widgetUrl}"
  width="480"
  height="640"
  frameborder="0"
  allow="clipboard-write"
  style="border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);"
></iframe>`
}

/* ─── Copy button ─── */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0 gap-1.5"
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
        size={14}
        className={cn(copied ? "text-success" : "text-muted-foreground")}
      />
      {copied ? label.replace(/^.*/, "✓") : label}
    </Button>
  )
}

/* ─── URL param row ─── */

function ParamRow({
  name,
  description,
  required,
  example,
}: {
  name: string
  description: string
  required?: boolean
  example: string
}) {
  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-3 items-start py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded-sm font-mono text-foreground">
          {name}
        </code>
        {required && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-error border-error/30">
            مطلوب
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <code className="text-xs text-muted-foreground font-mono">{example}</code>
    </div>
  )
}

/* ─── Main component ─── */

export function WidgetTab({ t }: Props) {
  const [locale, setLocale] = useState<"ar" | "en">("ar")
  const [practitioner, setPractitioner] = useState("")
  const [service, setService] = useState("")
  const [embedOrigin, setEmbedOrigin] = useState("")

  const widgetUrl = buildWidgetUrl({
    practitioner: practitioner || undefined,
    service: service || undefined,
    locale,
    origin: embedOrigin,
  })

  const snippet = buildIframeSnippet(widgetUrl)

  return (
    <div className="space-y-6">

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 bg-info/5 border border-info/20 rounded-lg px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} size={18} className="text-info mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          {t("settings.widget.info")}
        </p>
      </div>

      {/* ── Configurator ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={CodeSquareIcon} size={16} className="text-primary" />
            {t("settings.widget.configure")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("settings.widget.configureDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Origin (required for security) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              {t("settings.widget.origin")}
              <span className="text-error ms-1">*</span>
            </Label>
            <Input
              dir="ltr"
              placeholder="https://yourclinic.com"
              value={embedOrigin}
              onChange={(e) => setEmbedOrigin(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{t("settings.widget.originHint")}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Locale */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("settings.widget.locale")}</Label>
              <div className="flex gap-2">
                {(["ar", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors",
                      locale === l
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-surface-muted",
                    )}
                  >
                    {l === "ar" ? "عربي" : "English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Practitioner ID */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("settings.widget.practitioner")}</Label>
              <Input
                dir="ltr"
                placeholder={t("settings.widget.optional")}
                value={practitioner}
                onChange={(e) => setPractitioner(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Service ID */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("settings.widget.service")}</Label>
              <Input
                dir="ltr"
                placeholder={t("settings.widget.optional")}
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Generated URL ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={LinkSquare01Icon} size={16} className="text-primary" />
            {t("settings.widget.widgetUrl")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="flex-1 text-xs bg-surface-muted rounded-md px-3 py-2.5 font-mono text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-thin"
            >
              {widgetUrl}
            </code>
            <CopyButton text={widgetUrl} label={t("settings.widget.copy")} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-primary"
            onClick={() => window.open(widgetUrl, "_blank")}
          >
            <HugeiconsIcon icon={LinkSquare01Icon} size={14} />
            {t("settings.widget.preview")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Embed snippet ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={CodeSquareIcon} size={16} className="text-primary" />
            {t("settings.widget.embedCode")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("settings.widget.embedCodeDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre
              dir="ltr"
              className="text-xs bg-surface-muted rounded-lg px-4 py-4 font-mono text-foreground overflow-x-auto whitespace-pre leading-relaxed"
            >
              {snippet}
            </pre>
            <div className="absolute top-2 end-2">
              <CopyButton text={snippet} label={t("settings.widget.copy")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── URL params reference ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("settings.widget.params")}</CardTitle>
          <CardDescription className="text-sm">{t("settings.widget.paramsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ParamRow
            name="origin"
            description={t("settings.widget.param.origin")}
            required
            example="https://yourclinic.com"
          />
          <ParamRow
            name="locale"
            description={t("settings.widget.param.locale")}
            example="ar | en"
          />
          <ParamRow
            name="practitioner"
            description={t("settings.widget.param.practitioner")}
            example="uuid"
          />
          <ParamRow
            name="service"
            description={t("settings.widget.param.service")}
            example="uuid"
          />
        </CardContent>
      </Card>

    </div>
  )
}
