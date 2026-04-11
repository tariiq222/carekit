"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useLocale } from "@/components/locale-provider"
import { useServiceBookingTypes } from "@/hooks/use-services"
import {
  usePractitionerServiceMutations,
  usePractitionerServiceTypes,
} from "@/hooks/use-practitioners"
import { PractitionerServiceTypesEditor } from "./practitioner-service-types-editor"
import type { PractitionerService, PractitionerTypeConfigPayload } from "@/lib/types/practitioner"
import {
  editPractitionerServiceSchema,
  type EditPractitionerServiceFormData,
} from "@/lib/schemas/practitioner.schema"

/* ─── Props ─── */

interface EditPractitionerServiceSheetProps {
  practitionerId: string
  practitionerService: PractitionerService | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditPractitionerServiceSheet({
  practitionerId,
  practitionerService: ps,
  open,
  onOpenChange,
}: EditPractitionerServiceSheetProps) {
  const { locale, t } = useLocale()
  const { updateMut } = usePractitionerServiceMutations(practitionerId)

  /* Types state managed outside react-hook-form */
  const [typeConfigs, setTypeConfigs] = useState<PractitionerTypeConfigPayload[]>([])

  const serviceId = ps?.serviceId ?? null
  const { data: serviceBookingTypes } = useServiceBookingTypes(serviceId)
  const { data: existingTypes } = usePractitionerServiceTypes(
    practitionerId,
    serviceId,
  )

  const form = useForm<EditPractitionerServiceFormData>({
    resolver: zodResolver(editPractitionerServiceSchema),
    defaultValues: {
      bufferMinutes: 0,
      isActive: true,
    },
  })

  /* Populate from current data */
  useEffect(() => {
    if (!ps || !open) return
    form.reset({
      bufferMinutes: ps.bufferMinutes,
      isActive: ps.isActive,
    })
  }, [ps, open, form])

  /* Populate type configs from existing practitioner service types */
  useEffect(() => {
    if (!existingTypes || !open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypeConfigs(
      existingTypes.map((et) => ({
        bookingType: et.bookingType,
        price: et.price,
        duration: et.duration,
        useCustomOptions: et.useCustomOptions,
        isActive: et.isActive,
        durationOptions: et.durationOptions.map((o) => ({
          label: o.label,
          labelAr: o.labelAr ?? undefined,
          durationMinutes: o.durationMinutes,
          price: o.price,
          isDefault: o.isDefault,
          sortOrder: o.sortOrder,
        })),
      })),
    )
  }, [existingTypes, open])

  /* Fallback: if no existing types but we have service booking types, init from those */
  useEffect(() => {
    if (existingTypes && existingTypes.length > 0) return
    if (!ps || !serviceBookingTypes || !open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypeConfigs(
      ps.availableTypes.map((bt) => ({
        bookingType: bt,
        price: null,
        duration: null,
        useCustomOptions: false,
        isActive: true,
        durationOptions: [],
      })),
    )
  }, [existingTypes, serviceBookingTypes, ps, open])

  const serviceName = ps
    ? locale === "ar"
      ? ps.service.nameAr
      : ps.service.nameEn
    : ""

  const onSubmit = form.handleSubmit(async (data: EditPractitionerServiceFormData) => {
    if (!ps) return
    try {
      await updateMut.mutateAsync({
        serviceId: ps.serviceId,
        payload: {
          availableTypes: typeConfigs.map((tc) => tc.bookingType),
          bufferMinutes: data.bufferMinutes,
          isActive: data.isActive,
          types: typeConfigs,
        },
      })
      toast.success(t("practitioners.services.updateSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update service",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>{serviceName}</SheetTitle>
          <SheetDescription>
            {t("practitioners.services.editDesc")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form
            id="edit-practitioner-service-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-5"
          >
            {/* Per-type config */}
            {serviceBookingTypes && (
              <PractitionerServiceTypesEditor
                serviceBookingTypes={serviceBookingTypes}
                value={typeConfigs}
                onChange={setTypeConfigs}
                t={t}
                locale={locale}
              />
            )}

            {/* Buffer */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                {t("practitioners.services.bufferMinutes")}
              </Label>
              <Input
                type="number"
                min="0"
                className="tabular-nums"
                {...form.register("bufferMinutes")}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label>{t("common.active")}</Label>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="edit-practitioner-service-form"
            disabled={updateMut.isPending}
          >
            {updateMut.isPending
              ? t("practitioners.services.saving")
              : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
