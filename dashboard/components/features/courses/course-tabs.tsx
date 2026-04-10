"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { CourseFormValues, CourseWizardStep } from "@/lib/schemas/courses.schema"
import { CourseStepInfo } from "./course-step-info"
import { CourseStepSessions } from "./course-step-sessions"
import { CourseStepPricing } from "./course-step-pricing"
import { CourseStepReview } from "./course-step-review"

interface CourseTabsProps {
  form: UseFormReturn<CourseFormValues>
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

export function CourseTabs({ form, onSubmit, onCancel, isPending }: CourseTabsProps) {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<CourseWizardStep>(1)

  const submitLabel = isPending ? t("common.saving") : t("courses.wizard.submit")

  const tabs: { id: CourseWizardStep; label: string; desc: string }[] = [
    {
      id: 1,
      label: t("courses.wizard.step1"),
      desc: t("courses.wizard.step1Desc"),
    },
    {
      id: 2,
      label: t("courses.wizard.step2"),
      desc: t("courses.wizard.step2Desc"),
    },
    {
      id: 3,
      label: t("courses.wizard.step3"),
      desc: t("courses.wizard.step3Desc"),
    },
    {
      id: 4,
      label: t("courses.wizard.step4"),
      desc: t("courses.wizard.step4Desc"),
    },
  ]

  const handleTabChange = (tabId: CourseWizardStep) => {
    setActiveTab(tabId)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[480px]">
          {/* ── Vertical Sidebar Navigation ── */}
          <div className="w-56 shrink-0 border-e border-border bg-surface-muted flex flex-col">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("courses.createTitle")}
              </p>
            </div>
            <div role="tablist" className="flex-1 p-2 space-y-1">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  tabIndex={0}
                  onClick={() => handleTabChange(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleTabChange(tab.id)
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
            {activeTab === 1 && <CourseStepInfo form={form} />}
            {activeTab === 2 && <CourseStepSessions form={form} />}
            {activeTab === 3 && <CourseStepPricing form={form} />}
            {activeTab === 4 && (
              <CourseStepReview form={form} onGoToStep={setActiveTab} />
            )}
          </div>
        </div>
      </Card>

      {/* ── Sticky Footer ── */}
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
