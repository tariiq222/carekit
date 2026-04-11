"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLocale } from "@/components/locale-provider"
import { useServices, useServiceBookingTypes } from "@/hooks/use-services"
import {
  usePractitionerServices,
  usePractitionerServiceMutations,
} from "@/hooks/use-practitioners"
import { PractitionerServiceTypesEditor } from "./practitioner-service-types-editor"
import type { PractitionerService, PractitionerTypeConfigPayload } from "@/lib/types/practitioner"
import {
  assignServiceSchema,
  type AssignServiceFormData,
} from "@/lib/schemas/practitioner.schema"

/* ─── Props ─── */

interface AssignServiceSheetProps {
  practitionerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function AssignServiceSheet({
  practitionerId,
  open,
  onOpenChange,
}: AssignServiceSheetProps) {
  const { locale, t } = useLocale()
  const { services } = useServices()
  const { data: assignedServices } =
    usePractitionerServices(practitionerId)
  const { assignMut } = usePractitionerServiceMutations(practitionerId)

  /* Types state managed outside of react-hook-form */
  const [typeConfigs, setTypeConfigs] = useState<PractitionerTypeConfigPayload[]>([])

  const availableServices = useMemo(() => {
    const assignedIds = new Set(
      (assignedServices ?? []).map(
        (ps: PractitionerService) => ps.serviceId,
      ),
    )
    return (services ?? []).filter((s) => !assignedIds.has(s.id))
  }, [services, assignedServices])

  const form = useForm<AssignServiceFormData>({
    resolver: zodResolver(assignServiceSchema),
    defaultValues: {
      serviceId: "",
      bufferMinutes: 0,
      isActive: true,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
      setTypeConfigs([])
    }
  }, [open, form])

  const selectedServiceId = form.watch("serviceId")
  const { data: serviceBookingTypes } = useServiceBookingTypes(
    selectedServiceId || null,
  )

  /* Initialize type configs when service booking types load */
  useEffect(() => {
    if (serviceBookingTypes && serviceBookingTypes.length > 0) {
      setTypeConfigs(
        serviceBookingTypes
          .filter((bt) => bt.isActive)
          .map((bt) => ({
            bookingType: bt.bookingType,
            price: null,
            duration: null,
            useCustomOptions: false,
            isActive: true,
            durationOptions: [],
          })),
      )
    } else {
      setTypeConfigs([])
    }
  }, [serviceBookingTypes])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await assignMut.mutateAsync({
        serviceId: data.serviceId,
        availableTypes: typeConfigs.map((tc) => tc.bookingType),
        bufferMinutes: data.bufferMinutes,
        isActive: data.isActive,
        types: typeConfigs,
      })
      toast.success(t("practitioners.services.assignSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign service",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>{t("practitioners.services.assign")}</SheetTitle>
          <SheetDescription>
            {t("practitioners.services.assignDesc")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form
            id="assign-service-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-5"
          >
            {/* Service Select */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("detail.service")}</Label>
              <Controller
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "practitioners.services.selectService",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {locale === "ar" ? s.nameAr : s.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.serviceId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.serviceId.message}
                </p>
              )}
            </div>

            {/* Per-type config */}
            {selectedServiceId && serviceBookingTypes && (
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
            form="assign-service-form"
            disabled={assignMut.isPending}
          >
            {assignMut.isPending
              ? t("practitioners.services.saving")
              : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
