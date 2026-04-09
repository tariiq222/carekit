"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { createSessionSchema, type CreateSessionFormValues } from "@/lib/schemas/group-sessions.schema"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GroupOffering } from "@/lib/types/group-sessions"

interface Props {
  offering: GroupOffering | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScheduleSessionDialog({ offering, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { createSessionMut } = useGroupSessionsMutations()

  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: { startTime: "", registrationDeadline: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    if (!offering) return
    await createSessionMut.mutateAsync({ offeringId: offering.id, ...data })
    toast.success(t("groupSessions.sessionScheduled"))
    form.reset()
    onOpenChange(false)
  })

  const name = offering ? (locale === "ar" ? offering.nameAr : offering.nameEn) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groupSessions.scheduleSession")}: {name}</DialogTitle>
        </DialogHeader>

        <form id="schedule-session-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groupSessions.startTime")}</Label>
            <Input type="datetime-local" {...form.register("startTime")} />
            {form.formState.errors.startTime && (
              <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("groupSessions.registrationDeadline")}</Label>
            <Input type="datetime-local" {...form.register("registrationDeadline")} />
            {form.formState.errors.registrationDeadline && (
              <p className="text-xs text-destructive">{form.formState.errors.registrationDeadline.message}</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" form="schedule-session-form" disabled={createSessionMut.isPending}>
            {createSessionMut.isPending ? t("common.saving") : t("groupSessions.schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
