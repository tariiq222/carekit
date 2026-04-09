"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { setDateSchema, type SetDateFormValues } from "@/lib/schemas/group-sessions.schema"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateTimeInput } from "@/components/ui/date-time-input"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}

export function SetDateDialog({ open, onOpenChange, sessionId }: Props) {
  const { t } = useLocale()
  const { updateSessionMut } = useGroupSessionsMutations()

  const form = useForm<SetDateFormValues>({
    resolver: zodResolver(setDateSchema),
    defaultValues: { startTime: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    await updateSessionMut.mutateAsync({ id: sessionId, startTime: data.startTime })
    toast.success(t("groupSessions.dateSet"))
    form.reset()
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groupSessions.setDate")}</DialogTitle>
        </DialogHeader>

        <form id="set-date-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groupSessions.startTime")}</Label>
            <Controller
              name="startTime"
              control={form.control}
              render={({ field }) => (
                <DateTimeInput value={field.value} onChange={field.onChange} />
              )}
            />
            {form.formState.errors.startTime && (
              <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" form="set-date-form" disabled={updateSessionMut.isPending}>
            {updateSessionMut.isPending ? t("common.saving") : t("groupSessions.setDate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
