"use client"

import { useState } from "react"
import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeBreaks } from "@/hooks/use-employees"
import { DAY_NAME_KEYS } from "@/components/features/employees/create/schedule-types"
import { BreaksEditor } from "./breaks-editor"

interface BreaksSectionProps {
  employeeId: string
}

export function BreaksSection({ employeeId }: BreaksSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const { t } = useLocale()
  const { data: breaks, isLoading } = useEmployeeBreaks(employeeId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("breaks.sectionTitle")}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditorOpen(true)}
        >
          {t("breaks.editButton")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t("breaks.loading")}</p>
      ) : !breaks || breaks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("breaks.noBreaksConfigured")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {breaks.map((b, i) => (
            <div
              key={b.id ?? `${b.dayOfWeek}-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {t(DAY_NAME_KEYS[b.dayOfWeek])}
              </span>
              <span className="tabular-nums font-medium text-foreground">
                {b.startTime} — {b.endTime}
              </span>
            </div>
          ))}
        </div>
      )}

      <BreaksEditor
        employeeId={employeeId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
