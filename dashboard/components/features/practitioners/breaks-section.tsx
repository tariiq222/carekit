"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { usePractitionerBreaks } from "@/hooks/use-practitioners"
import { BreaksEditor } from "./breaks-editor"

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

interface BreaksSectionProps {
  practitionerId: string
}

/* ─── Component ─── */

export function BreaksSection({ practitionerId }: BreaksSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const { data: breaks, isLoading } = usePractitionerBreaks(practitionerId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Breaks
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditorOpen(true)}
        >
          Edit Breaks
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !breaks || breaks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No breaks configured.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {breaks.map((b, i) => (
            <div
              key={b.id ?? `${b.dayOfWeek}-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {DAY_NAMES[b.dayOfWeek]}
              </span>
              <span className="tabular-nums font-medium text-foreground">
                {b.startTime} — {b.endTime}
              </span>
            </div>
          ))}
        </div>
      )}

      <BreaksEditor
        practitionerId={practitionerId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
