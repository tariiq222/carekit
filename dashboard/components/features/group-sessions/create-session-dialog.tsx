"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { createGroupSessionSchema, type CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DateTimeInput } from "@/components/ui/date-time-input"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateSessionDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { createSessionMut } = useGroupSessionsMutations()

  const form = useForm<CreateGroupSessionFormValues>({
    resolver: zodResolver(createGroupSessionSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      practitionerId: "",
      minParticipants: 2,
      maxParticipants: 10,
      pricePerPersonHalalat: 0,
      durationMinutes: 60,
      paymentDeadlineHours: 48,
      schedulingMode: "fixed_date",
      isPublished: false,
    },
  })

  const schedulingMode = form.watch("schedulingMode")

  const onSubmit = form.handleSubmit(async (data) => {
    await createSessionMut.mutateAsync(data)
    toast.success(t("groupSessions.sessionCreated"))
    form.reset()
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("groupSessions.addSession")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="create-session-form" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("groupSessions.nameAr")}</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameAr.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("groupSessions.nameEn")}</Label>
                <Input {...form.register("nameEn")} dir="ltr" />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.descriptionAr")}</Label>
              <Textarea {...form.register("descriptionAr")} dir="rtl" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.descriptionEn")}</Label>
              <Textarea {...form.register("descriptionEn")} dir="ltr" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.practitioner")}</Label>
              <Input {...form.register("practitionerId")} placeholder="UUID" />
              {form.formState.errors.practitionerId && (
                <p className="text-xs text-destructive">{form.formState.errors.practitionerId.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("groupSessions.minParticipants")}</Label>
                <Input type="number" {...form.register("minParticipants", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>{t("groupSessions.maxParticipants")}</Label>
                <Input type="number" {...form.register("maxParticipants", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("groupSessions.pricePerPerson")}</Label>
                <Input type="number" {...form.register("pricePerPersonHalalat", { valueAsNumber: true })} />
                <p className="text-xs text-muted-foreground">{t("groupSessions.priceHint")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("groupSessions.duration")}</Label>
                <Input type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.paymentDeadline")}</Label>
              <Input type="number" {...form.register("paymentDeadlineHours", { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">{t("groupSessions.paymentDeadlineHint")}</p>
            </div>

            {/* Scheduling mode */}
            <div className="space-y-3 rounded-lg border border-border/40 p-4">
              <Label className="font-semibold">{t("groupSessions.scheduling")}</Label>
              <RadioGroup
                value={schedulingMode}
                onValueChange={(v) => form.setValue("schedulingMode", v as "fixed_date" | "on_capacity")}
                className="flex flex-col gap-3"
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <RadioGroupItem value="fixed_date" />
                  <span className="text-sm">{t("groupSessions.fixedDate")}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <RadioGroupItem value="on_capacity" />
                  <span className="text-sm">{t("groupSessions.onCapacity")}</span>
                </label>
              </RadioGroup>

              {schedulingMode === "fixed_date" && (
                <div className="space-y-2 pt-2">
                  <Label>{t("groupSessions.startTime")}</Label>
                  <Controller
                    name="startTime"
                    control={form.control}
                    render={({ field }) => (
                      <DateTimeInput value={field.value ?? ""} onChange={field.onChange} />
                    )}
                  />
                  {form.formState.errors.startTime && (
                    <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Visibility & expiry */}
            <div className="space-y-3 rounded-lg border border-border/40 p-4">
              <div className="flex items-center justify-between">
                <Label>{t("groupSessions.publishForClients")}</Label>
                <Switch
                  checked={form.watch("isPublished")}
                  onCheckedChange={(v) => form.setValue("isPublished", v)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("groupSessions.expiresAt")}</Label>
                <Controller
                  name="expiresAt"
                  control={form.control}
                  render={({ field }) => (
                    <DateTimeInput value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
                <p className="text-xs text-muted-foreground">{t("groupSessions.expiresAtHint")}</p>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            type="submit"
            form="create-session-form"
            disabled={createSessionMut.isPending}
          >
            {createSessionMut.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
