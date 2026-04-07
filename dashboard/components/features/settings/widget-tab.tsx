"use client"

/**
 * Widget Tab — Booking widget configuration & embed instructions
 */

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LinkSquare01Icon,
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

type TabId = "behaviour" | "embed"

/* ─── URL builder ─── */

const DASHBOARD_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://dashboard.carekit.app"

function buildWidgetUrl(opts: { origin: string }) {
  const url = new URL(`${DASHBOARD_ORIGIN}/booking`)
  if (opts.origin) url.searchParams.set("origin", opts.origin)
  return url.toString()
}

function buildScriptSnippet(_origin: string) {
  const src = `${DASHBOARD_ORIGIN}/widget/embed.js`
  return `<!-- اللغة تُكتشف تلقائياً من <html lang="..."> -->
<script src="${src}" data-auto-open></script>

<!-- أو افتح برمجياً -->
<button onclick="CareKitWidget.open()">احجز الآن</button>`
}

/* ─── Behaviour Panel ─── */

function BehaviourPanel({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = useWidgetSettings()
  const mutation = useWidgetSettingsMutation()

  const [showPrice, setShowPrice] = useState(() => data?.widgetShowPrice ?? true)
  const [anyPractitioner, setAnyPractitioner] = useState(() => data?.widgetAnyPractitioner ?? false)
  const [redirectUrl, setRedirectUrl] = useState(() => data?.widgetRedirectUrl ?? "")

  const dataKey = data ? JSON.stringify(data) : null
  useEffect(() => {
    if (!data) return
    setShowPrice(data.widgetShowPrice)
    setAnyPractitioner(data.widgetAnyPractitioner)
    setRedirectUrl(data.widgetRedirectUrl ?? "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-1 pb-1 divide-y divide-border">
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t("settings.widget.showPrice")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.widget.showPriceDesc")}</p>
            </div>
            <Switch checked={showPrice} onCheckedChange={setShowPrice} />
          </div>
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t("settings.widget.anyPractitioner")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.widget.anyPractitionerDesc")}</p>
            </div>
            <Switch checked={anyPractitioner} onCheckedChange={setAnyPractitioner} />
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm bg-surface">
        <CardContent className="space-y-2 pt-3 pb-3">
          <Label>{t("settings.widget.redirectUrl")}</Label>
          <Input dir="ltr" placeholder="https://yourclinic.com/thank-you" value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">{t("settings.widget.redirectUrlDesc")}</p>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate(
          { widgetShowPrice: showPrice, widgetAnyPractitioner: anyPractitioner, widgetRedirectUrl: redirectUrl.trim() || undefined },
          { onSuccess: () => toast.success(t("settings.saved")), onError: (err: Error) => toast.error(err.message) }
        )}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Embed Panel ─── */

function EmbedPanel({ t }: { t: (key: string) => string }) {
  const [embedOrigin, setEmbedOrigin] = useState("")
  const widgetUrl = buildWidgetUrl({ origin: embedOrigin })
  const snippet = buildScriptSnippet(embedOrigin)

  return (
    <div className="flex flex-col gap-3 h-full">
      <Card className="shadow-sm bg-surface">
        <CardContent className="space-y-2 pt-3 pb-3">
          <Label>
            {t("settings.widget.origin")}
            <span className="text-error ms-1">*</span>
          </Label>
          <Input dir="ltr" placeholder="https://yourclinic.com" value={embedOrigin}
            onChange={(e) => setEmbedOrigin(e.target.value)} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">{t("settings.widget.originHint")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-3 pb-3 space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("settings.widget.widgetUrl")}</p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 text-xs bg-surface-muted rounded-md px-3 py-2.5 font-mono text-muted-foreground overflow-x-auto whitespace-nowrap">
                {widgetUrl}
              </code>
              <CopyButton text={widgetUrl} label={t("settings.widget.copy")} />
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary px-0"
              onClick={() => window.open(widgetUrl, "_blank")}>
              <HugeiconsIcon icon={LinkSquare01Icon} size={14} />
              {t("settings.widget.preview")}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("settings.widget.embedSnippet")}</p>
            <div className="relative">
              <pre dir="ltr" className="text-xs bg-surface-muted rounded-lg px-4 py-4 font-mono text-foreground overflow-x-auto whitespace-pre leading-relaxed">
                {snippet}
              </pre>
              <div className="absolute top-2 end-2">
                <CopyButton text={snippet} label={t("settings.widget.copy")} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Main ─── */

export function WidgetTab({ t }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("behaviour")

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "behaviour", label: t("settings.widget.behaviourTitle"), desc: t("settings.widget.behaviourDesc") },
    { id: "embed", label: t("settings.widget.embedCode"), desc: t("settings.widget.embedCodeDesc") },
  ]

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-info/5 border border-info/20 rounded-lg px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} size={18} className="text-info mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">{t("settings.widget.info")}</p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[420px]">
          {/* ── Sidebar ── */}
          <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("settings.tabs.widget")}
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
            {activeTab === "behaviour" && <BehaviourPanel t={t} />}
            {activeTab === "embed" && <EmbedPanel t={t} />}
          </div>
        </div>
      </Card>
    </div>
  )
}
