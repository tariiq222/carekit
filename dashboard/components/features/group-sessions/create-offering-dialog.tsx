"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { createOfferingSchema, type CreateOfferingFormValues } from "@/lib/schemas/group-sessions.schema"
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOfferingDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { createOfferingMut } = useGroupSessionsMutations()

  const form = useForm<CreateOfferingFormValues>({
    resolver: zodResolver(createOfferingSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      practitionerId: "",
      minParticipants: 2,
      maxParticipants: 10,
      pricePerPersonHalalat: 0,
      durationMin: 60,
      paymentDeadlineHours: 48,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    await createOfferingMut.mutateAsync(data)
    toast.success(t("groupSessions.offeringCreated"))
    form.reset()
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("groupSessions.addOffering")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="create-offering-form" onSubmit={onSubmit} className="flex flex-col gap-4">
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
                <Input type="number" {...form.register("durationMin", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.paymentDeadline")}</Label>
              <Input type="number" {...form.register("paymentDeadlineHours", { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">{t("groupSessions.paymentDeadlineHint")}</p>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            type="submit"
            form="create-offering-form"
            disabled={createOfferingMut.isPending}
          >
            {createOfferingMut.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
