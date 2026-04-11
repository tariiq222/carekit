"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { useLocale } from "@/components/locale-provider"
import { useServices, useServiceBookingTypes } from "@/hooks/use-services"
import type { PractitionerTypeConfigPayload } from "@/lib/types/practitioner"
import {
  addServiceSchema,
  nextDraftKey,
  type AddServiceFormData,
} from "./draft-service.types"
import { AddServiceForm } from "./add-service-form"
import { ServiceSummaryCard } from "./service-summary-card"

export type { DraftService } from "./draft-service.types"

/* ─── Props ─── */

interface ServicesTabProps {
  draftServices: import("./draft-service.types").DraftService[]
  onDraftServicesChange: (
    services: import("./draft-service.types").DraftService[],
  ) => void
}

/* ─── Component ─── */

export function ServicesTab({
  draftServices,
  onDraftServicesChange,
}: ServicesTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const { services } = useServices()
  const [isAdding, setIsAdding] = useState(false)
  const [typeConfigs, setTypeConfigs] = useState<PractitionerTypeConfigPayload[]>([])

  /* Filter out already-added services */
  const availableServices = useMemo(
    () => {
      const addedServiceIds = new Set(draftServices.map((ds) => ds.serviceId))
      return (services ?? []).filter((s) => !addedServiceIds.has(s.id))
    },
    [services, draftServices],
  )

  const form = useForm<AddServiceFormData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: { serviceId: "", bufferMinutes: 0, isActive: true },
  })

  const selectedServiceId = form.watch("serviceId")
  const { data: serviceBookingTypes } = useServiceBookingTypes(
    selectedServiceId || null,
  )

  /* Initialize type configs when service booking types load */
  useEffect(() => {
    if (!selectedServiceId) {
      setTypeConfigs([])
      return
    }
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
    } else if (serviceBookingTypes !== undefined) {
      // Service has no booking type records — fall back to both types as defaults
      setTypeConfigs([
        { bookingType: "in_person", price: null, duration: null, useCustomOptions: false, isActive: true, durationOptions: [] },
        { bookingType: "online", price: null, duration: null, useCustomOptions: false, isActive: true, durationOptions: [] },
      ])
    }
  }, [serviceBookingTypes, selectedServiceId])

  const handleAddService = form.handleSubmit((data) => {
    const svc = services?.find((s) => s.id === data.serviceId)
    if (!svc) return

    onDraftServicesChange([
      ...draftServices,
      {
        key: nextDraftKey(),
        serviceId: data.serviceId,
        serviceName: isAr ? svc.nameAr : svc.nameEn,
        bufferMinutes: data.bufferMinutes,
        isActive: data.isActive,
        availableTypes: typeConfigs.map((tc) => tc.bookingType),
        types: typeConfigs,
      },
    ])
    form.reset()
    setTypeConfigs([])
    setIsAdding(false)
  })

  const removeService = (key: string) => {
    onDraftServicesChange(draftServices.filter((ds) => ds.key !== key))
  }

  const handleCancel = () => {
    setIsAdding(false)
    form.reset()
    setTypeConfigs([])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("practitioners.create.tabs.services")}</CardTitle>
        <CardDescription>
          {t("practitioners.create.servicesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draftServices.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">
            {t("practitioners.create.noServices")}
          </p>
        )}

        {draftServices.map((ds) => (
          <ServiceSummaryCard
            key={ds.key}
            draft={ds}
            onRemove={() => removeService(ds.key)}
          />
        ))}

        {isAdding ? (
          <AddServiceForm
            form={form}
            availableServices={availableServices}
            serviceBookingTypes={serviceBookingTypes ?? []}
            typeConfigs={typeConfigs}
            onTypeConfigsChange={setTypeConfigs}
            onSubmit={handleAddService}
            onCancel={handleCancel}
            t={t}
            locale={locale}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => setIsAdding(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("practitioners.create.addService")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
