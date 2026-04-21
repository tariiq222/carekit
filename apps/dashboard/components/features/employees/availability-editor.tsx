"use client"

import { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@carekit/ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import {
  useEmployeeAvailability,
  useSetAvailability,
} from "@/hooks/use-employees"
import type { AvailabilitySlot } from "@/lib/types/employee"

/* ─── Constants ─── */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const DEFAULT_SCHEDULE: AvailabilitySlot[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  startTime: "09:00",
  endTime: "17:00",
  isActive: i >= 0 && i <= 4, // Mon-Fri active by default
}))

/* ─── Schema ─── */

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm format required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm format required"),
  isActive: z.boolean(),
})

const scheduleSchema = z.object({
  schedule: z.array(slotSchema).length(7),
})

type FormData = z.infer<typeof scheduleSchema>

/* ─── Props ─── */

interface AvailabilityEditorProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function AvailabilityEditor({
  employeeId,
  open,
  onOpenChange,
}: AvailabilityEditorProps) {
  const { data: slots } = useEmployeeAvailability(employeeId)
  const setAvailability = useSetAvailability()

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { schedule: DEFAULT_SCHEDULE },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedule",
  })

  /* Populate from server data */
  useEffect(() => {
    if (!slots || slots.length === 0) return
    const merged = DEFAULT_SCHEDULE.map((def) => {
      const match = slots.find((s) => s.dayOfWeek === def.dayOfWeek)
      return match ?? { ...def, isActive: false }
    })
    form.reset({ schedule: merged })
  }, [slots, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const activeSlots = data.schedule.filter((s) => s.isActive)
      await setAvailability.mutateAsync({
        id: employeeId,
        schedule: activeSlots,
      })
      toast.success("Schedule updated successfully")
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update schedule",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Edit Weekly Schedule</SheetTitle>
          <SheetDescription>
            Set working hours for each day of the week.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="availability-editor-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {fields.map((field, index) => {
              const isActive = form.watch(`schedule.${index}.isActive`)
              return (
                <div
                  key={field.id}
                  className="flex items-center gap-3 rounded-md border border-border p-2"
                >
                  <div className="flex w-24 shrink-0 items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(v) =>
                        form.setValue(`schedule.${index}.isActive`, v)
                      }
                    />
                    <Label className="text-xs font-medium">
                      {DAY_NAMES[index]}
                    </Label>
                  </div>

                  <Input
                    type="time"
                    disabled={!isActive}
                    className="h-8 text-xs tabular-nums"
                    {...form.register(`schedule.${index}.startTime`)}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    disabled={!isActive}
                    className="h-8 text-xs tabular-nums"
                    {...form.register(`schedule.${index}.endTime`)}
                  />
                </div>
              )
            })}

            {form.formState.errors.schedule && (
              <p className="text-xs text-destructive">
                Please fix schedule errors.
              </p>
            )}
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="availability-editor-form" disabled={setAvailability.isPending}>
            {setAvailability.isPending ? "Saving..." : "Save Schedule"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
