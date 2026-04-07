"use client"

/**
 * Widget Tab — Booking widget configuration & embed instructions
 *
 * Layout (top → bottom):
 *  1. Widget Behaviour Settings  ← DB-persisted, affects the live widget
 *  2. Embed Configurator         ← generates URL / snippet for copy-paste
 *  3. Generated URL + Preview
 *  4. Embed Snippet (script tag)
 *  5. URL Params reference
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LinkSquare01Icon,
  CodeSquareIcon,
  Settings01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useWidgetSettings, useWidgetSettingsMutation } from "@/hooks/use-clinic-settings"
import { CopyButton } from "./widget-tab-helpers"

/* ─── Types ─── */

interface Props {
  t: (key: string) => string
}

/* ─── URL builder ─── */

const DASHBOARD_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://dashboard.carekit.app"

function buildWidgetUrl(opts: {
  origin: string
}) {
  const url = new URL(`${DASHBOARD_ORIGIN}/booking`)
  if (opts.origin)       url.searchParams.set("origin", opts.origin)
  return url.toString()
}

function buildScriptSnippet(_origin: string) {
  const src = `${DASHBOARD_ORIGIN}/widget/embed.js`
  return `<!-- اللغة تُكتشف تلقائياً من <html lang="..."> -->
<script src="${src}" data-auto-open></script>

<!-- أو افتح برمجياً -->
<button onclick="CareKitWidget.open()">احجز الآن</button>`
}

/* ─── 1. Widget Behaviour Settings ─── */

function WidgetBehaviourCard({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = useWidgetSettings()
  const mutation = useWidgetSettingsMutation()

  const [showPrice,       setShowPrice]       = useState(() => data?.widgetShowPrice ?? true)
  const [anyPractitioner, setAnyPractitioner] = useState(() => data?.widgetAnyPractitioner ?? false)
  const [redirectUrl,     setRedirectUrl]     = useState(() => data?.widgetRedirectUrl ?? "")

  // Sync local state when server data loads for the first time
  const dataKey = data ? JSON.stringify(data) : null
  useEffect(() => {
    if (!data) return
    setShowPrice(data.widgetShowPrice)
    setAnyPractitioner(data.widgetAnyPractitioner)
    setRedirectUrl(data.widgetRedirectUrl ?? "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  function handleSave() {
    mutation.mutate(
      {
        widgetShowPrice:          showPrice,
        widgetAnyPractitioner:    anyPractitioner,
        widgetRedirectUrl:        redirectUrl.trim() || undefined,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError:   (err: Error) => toast.error(err.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={Settings01Icon} size={16} className="text-primary" />
          {t("settings.widget.behaviourTitle")}
        </CardTitle>
        <CardDescription className="text-sm">
          {t("settings.widget.behaviourDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            {/* Show Price */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.widget.showPrice")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.widget.showPriceDesc")}</p>
              </div>
              <Switch checked={showPrice} onCheckedChange={setShowPrice} />
            </div>

            {/* Any Practitioner */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.widget.anyPractitioner")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.widget.anyPractitionerDesc")}</p>
              </div>
              <Switch checked={anyPractitioner} onCheckedChange={setAnyPractitioner} />
            </div>


            {/* Redirect URL */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {t("settings.widget.redirectUrl")}
              </Label>
              <Input
                dir="ltr"
                placeholder="https://yourclinic.com/thank-you"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.widget.redirectUrlDesc")}
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                {t("settings.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── 2. Embed Card (origin + URL + snippet — unified) ─── */

function EmbedCard({ t }: { t: (key: string) => string }) {
  const [embedOrigin, setEmbedOrigin] = useState("")

  const widgetUrl = buildWidgetUrl({ origin: embedOrigin })
  const snippet   = buildScriptSnippet(embedOrigin)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={CodeSquareIcon} size={16} className="text-primary" />
          {t("settings.widget.embedCode")}
        </CardTitle>
        <CardDescription className="text-sm">
          {t("settings.widget.embedCodeDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Origin */}
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

        <Separator />

        {/* Widget URL */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.widget.widgetUrl")}</p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="flex-1 text-xs bg-surface-muted rounded-md px-3 py-2.5 font-mono text-muted-foreground overflow-x-auto whitespace-nowrap"
            >
              {widgetUrl}
            </code>
            <CopyButton text={widgetUrl} label={t("settings.widget.copy")} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-primary px-0"
            onClick={() => window.open(widgetUrl, "_blank")}
          >
            <HugeiconsIcon icon={LinkSquare01Icon} size={14} />
            {t("settings.widget.preview")}
          </Button>
        </div>

        <Separator />

        {/* Embed Snippet */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.widget.embedSnippet")}</p>
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
        </div>

      </CardContent>
    </Card>
  )
}

/* ─── Main ─── */

export function WidgetTab({ t }: Props) {
  return (
    <div className="space-y-6">

      {/* Info banner — full width */}
      <div className="flex items-start gap-3 bg-info/5 border border-info/20 rounded-lg px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} size={18} className="text-info mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">{t("settings.widget.info")}</p>
      </div>

      {/* 2-column grid — matches BookingTab layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WidgetBehaviourCard t={t} />
        <EmbedCard t={t} />
      </div>



    </div>
  )
}
