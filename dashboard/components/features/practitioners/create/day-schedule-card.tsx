"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useLocale } from "@/components/locale-provider"
import type { AvailabilitySlot } from "@/lib/types/practitioner"
import type { LocalBreak } from "./schedule-types"

interface DayScheduleCardProps {
  slot: AvailabilitySlot
  dayName: string
  dayBreaks: LocalBreak[]
  addBreakLabel: string
  onSlotChange: (field: keyof AvailabilitySlot, value: string | boolean) => void
  onAddBreak: () => void
  onRemoveBreak: (key: string) => void
  onUpdateBreak: (key: string, field: "startTime" | "endTime", value: string) => void
}

export function DayScheduleCard({
  slot,
  dayName,
  dayBreaks,
  addBreakLabel,
  onSlotChange,
  onAddBreak,
  onRemoveBreak,
  onUpdateBreak,
}: DayScheduleCardProps) {
  const { t } = useLocale()
  return (
    <div className="rounded-md border border-border p-3 space-y-2.5">
      {/* Day header: toggle + name */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{dayName}</Label>
        <Switch
          checked={slot.isActive}
          onCheckedChange={(v) => onSlotChange("isActive", v)}
        />
      </div>

      {/* Time range */}
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          disabled={!slot.isActive}
          className="h-9 text-xs tabular-nums"
          value={slot.startTime}
          onChange={(e) => onSlotChange("startTime", e.target.value)}
        />
        <span className="text-[10px] text-muted-foreground shrink-0">
          {t("schedule.to")}
        </span>
        <Input
          type="time"
          disabled={!slot.isActive}
          className="h-9 text-xs tabular-nums"
          value={slot.endTime}
          onChange={(e) => onSlotChange("endTime", e.target.value)}
        />
      </div>

      {/* Breaks */}
      {slot.isActive && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {dayBreaks.map((b) => (
            <div key={b.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {t("schedule.break")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onRemoveBreak(b.key)}
                >
                  {t("schedule.removeBreak")}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="time"
                  className="h-8 text-xs tabular-nums"
                  value={b.startTime}
                  onChange={(e) => onUpdateBreak(b.key, "startTime", e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {t("schedule.to")}
                </span>
                <Input
                  type="time"
                  className="h-8 text-xs tabular-nums"
                  value={b.endTime}
                  onChange={(e) => onUpdateBreak(b.key, "endTime", e.target.value)}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-xs text-muted-foreground"
            onClick={onAddBreak}
          >
            + {addBreakLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
