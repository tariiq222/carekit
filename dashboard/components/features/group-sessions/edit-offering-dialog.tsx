"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { createOfferingSchema, type CreateOfferingFormValues } from "@/lib/schemas/group-sessions.schema"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GroupOffering } from "@/lib/types/group-sessions"

interface Props {
  offering: GroupOffering | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditOfferingDialog({ offering, open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { updateOfferingMut } = useGroupSessionsMutations()

  const form = useForm<CreateOfferingFormValues>({
    resolver: zodResolver(createOfferingSchema),
  })

  useEffect(() => {
    if (offering) {
      form.reset({
        nameAr: offering.nameAr,
        nameEn: offering.nameEn,
        descriptionAr: offering.descriptionAr ?? "",
        descriptionEn: offering.descriptionEn ?? "",
        practitionerId: offering.practitionerId,
        minParticipants: offering.minParticipants,
        maxParticipants: offering.maxParticipants,
        pricePerPersonHalalat: offering.pricePerPersonHalalat,
        durationMin: offering.durationMin,
        paymentDeadlineHours: offering.paymentDeadlineHours,
      })
    }
  }, [offering, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!offering) return
    await updateOfferingMut.mutateAsync({ id: offering.id, ...data })
    toast.success(t("groupSessions.offeringUpdated"))
    onOpenChange(false)
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("groupSessions.editOffering")}</SheetTitle>
        </SheetHeader>

        <SheetBody>
          <form id="edit-offering-form" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("groupSessions.nameAr")}</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label>{t("groupSessions.nameEn")}</Label>
                <Input {...form.register("nameEn")} dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("groupSessions.descriptionAr")}</Label>
              <Textarea {...form.register("descriptionAr")} dir="rtl" rows={2} />
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
              </div>
              <div className="space-y-2">
                <Label>{t("groupSessions.duration")}</Label>
                <Input type="number" {...form.register("durationMin", { valueAsNumber: true })} />
              </div>
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" form="edit-offering-form" disabled={updateOfferingMut.isPending}>
            {updateOfferingMut.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
