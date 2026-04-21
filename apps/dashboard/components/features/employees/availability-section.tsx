"use client"

import { useState } from "react"

import { Badge } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { useEmployeeAvailability } from "@/hooks/use-employees"
import { AvailabilityEditor } from "./availability-editor"

/* ─── Constants ─── */

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const

/* ─── Props ─── */

interface AvailabilitySectionProps {
  employeeId: string
}

/* ─── Component ─── */

export function AvailabilitySection({
  employeeId,
}: AvailabilitySectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const { data: slots, isLoading } =
    useEmployeeAvailability(employeeId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Weekly Schedule
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditorOpen(true)}
        >
          Edit Schedule
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !slots || slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No schedule configured.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {slots.map((slot, i) => (
            <div
              key={`${slot.dayOfWeek}-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {DAY_NAMES[slot.dayOfWeek]}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-foreground">
                  {slot.startTime} — {slot.endTime}
                </span>
                <Badge
                  variant="outline"
                  className={
                    slot.isActive
                      ? "border-success/30 bg-success/10 text-success text-[10px]"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground text-[10px]"
                  }
                >
                  {slot.isActive ? "On" : "Off"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <AvailabilityEditor
        employeeId={employeeId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
