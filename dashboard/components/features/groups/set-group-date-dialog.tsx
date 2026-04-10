"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
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

const setGroupDateSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
})

type SetGroupDateFormValues = z.infer<typeof setGroupDateSchema>

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
}

export function SetGroupDateDialog({ open, onClose, groupId }: Props) {
  const { t } = useLocale()
  const { confirmScheduleMut } = useGroupsMutations()

  const form = useForm<SetGroupDateFormValues>({
    resolver: zodResolver(setGroupDateSchema),
    defaultValues: { startTime: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await confirmScheduleMut.mutateAsync({ id: groupId, startTime: data.startTime })
      toast.success(t("groups.dateSet"))
      form.reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groups.setDate")}</DialogTitle>
        </DialogHeader>

        <form id="set-group-date-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groups.startTime")}</Label>
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
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" form="set-group-date-form" disabled={confirmScheduleMut.isPending}>
            {confirmScheduleMut.isPending ? t("common.saving") : t("groups.setDate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
