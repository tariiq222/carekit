"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"
import { SessionStepInfo } from "./session-step-info"
import { SessionStepSettings } from "./session-step-settings"
import { SessionStepScheduling } from "./session-step-scheduling"

type TabId = "info" | "settings" | "scheduling"

interface SessionTabsProps {
  form: UseFormReturn<CreateGroupSessionFormValues>
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

export function SessionTabs({ form, onSubmit, onCancel, isPending }: SessionTabsProps) {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<TabId>("info")

  const submitLabel = isPending ? t("common.saving") : t("groupSessions.wizard.submit")

  const tabs: { id: TabId; label: string; desc: string }[] = [
    {
      id: "info",
      label: t("groupSessions.tabs.info"),
      desc: t("groupSessions.tabs.infoDesc"),
    },
    {
      id: "settings",
      label: t("groupSessions.tabs.settings"),
      desc: t("groupSessions.tabs.settingsDesc"),
    },
    {
      id: "scheduling",
      label: t("groupSessions.tabs.scheduling"),
      desc: t("groupSessions.tabs.schedulingDesc"),
    },
  ]

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[480px]">
          {/* ── Vertical Sidebar Navigation ── */}
          <div className="w-56 shrink-0 border-e border-border bg-surface-muted flex flex-col">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("groupSessions.createTitle")}
              </p>
            </div>
            <div role="tablist" className="flex-1 p-2 space-y-1">
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
                    "w-full rounded-lg px-3 py-3 cursor-pointer select-none transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                >
                  <p className="text-sm font-medium truncate leading-tight">
                    {tab.label}
                  </p>
                  {activeTab === tab.id && (
                    <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">
                      {tab.desc}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Content Panel ── */}
          <div
            role="tabpanel"
            className="flex-1 p-5 overflow-y-auto bg-surface-muted/50"
          >
            {activeTab === "info" && <SessionStepInfo form={form} />}
            {activeTab === "settings" && <SessionStepSettings form={form} />}
            {activeTab === "scheduling" && <SessionStepScheduling form={form} />}
          </div>
        </div>
      </Card>

      {/* ── Sticky Footer — matches service-form-page pattern ── */}
      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
