"use client"

import { useState } from "react"
import { useGroupOfferings } from "@/hooks/use-group-sessions"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { useLocale } from "@/components/locale-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Edit02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { SarSymbol } from "@/components/features/shared/sar-symbol"
import { ScheduleSessionDialog } from "./schedule-session-dialog"
import { EditOfferingDialog } from "./edit-offering-dialog"
import type { GroupOffering } from "@/lib/types/group-sessions"

export function OfferingsTabContent() {
  const { t, locale } = useLocale()
  const { offerings, isLoading } = useGroupOfferings()
  const { deleteOfferingMut } = useGroupSessionsMutations()
  const [scheduleTarget, setScheduleTarget] = useState<GroupOffering | null>(null)
  const [editTarget, setEditTarget] = useState<GroupOffering | null>(null)

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[200px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (offerings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">{t("groupSessions.noOfferings")}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offerings.map((offering) => {
          const name = locale === "ar" ? offering.nameAr : offering.nameEn
          const practitionerName = offering.practitioner?.nameAr ?? ""
          const isFree = offering.pricePerPersonHalalat === 0
          const upcomingSessions = offering._count?.sessions ?? 0

          return (
            <Card key={offering.id} className="glass flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{name}</h3>
                  <p className="text-sm text-muted-foreground">{practitionerName}</p>
                </div>
                <Badge variant="secondary">
                  {offering.minParticipants}–{offering.maxParticipants}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{offering.durationMin} {t("groupSessions.minutes")}</span>
                <span>
                  {isFree ? (
                    t("groupSessions.free")
                  ) : (
                    <>{(offering.pricePerPersonHalalat / 100).toFixed(0)} <SarSymbol size={12} /></>
                  )}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                {upcomingSessions} {t("groupSessions.upcomingSessions")}
              </div>

              <div className="mt-auto flex items-center gap-2 pt-2 border-t border-border/40">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-sm"
                      onClick={() => setScheduleTarget(offering)}
                    >
                      <HugeiconsIcon icon={Calendar03Icon} size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("groupSessions.scheduleSession")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-sm"
                      onClick={() => setEditTarget(offering)}
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.edit")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-sm text-destructive"
                      onClick={() => deleteOfferingMut.mutate(offering.id)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.delete")}</TooltipContent>
                </Tooltip>
              </div>
            </Card>
          )
        })}
      </div>

      <ScheduleSessionDialog
        offering={scheduleTarget}
        open={!!scheduleTarget}
        onOpenChange={(v) => !v && setScheduleTarget(null)}
      />

      <EditOfferingDialog
        offering={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
      />
    </>
  )
}
