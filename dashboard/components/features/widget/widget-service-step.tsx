"use client"

// Widget Service Step — supports practitioner_first and service_first flows

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building01Icon,
  Video01Icon,
  Loading03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { BookingFlowOrder } from "@/hooks/use-widget-booking"
import type { Practitioner } from "@/lib/types/practitioner"
import type { Service } from "@/lib/types/service"
import type { BookingType } from "@/lib/types/booking"

/* ─── Booking type config ─── */

const BOOKING_TYPE_CONFIG: Record<
  Exclude<BookingType, "walk_in">,
  { labelAr: string; labelEn: string; icon: React.ReactNode }
> = {
  in_person: {
    labelAr: "زيارة حضورية",
    labelEn: "In Person",
    icon: <HugeiconsIcon icon={Building01Icon} size={16} />,
  },
  online: {
    labelAr: "عن بعد",
    labelEn: "Online",
    icon: <HugeiconsIcon icon={Video01Icon} size={16} />,
  },
}

/* ─── Props ─── */

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
  flowOrder: BookingFlowOrder
}

export function WidgetServiceStep({ locale, booking, flowOrder }: Props) {
  const {
    practitionersData,
    practitionersLoading,
    services,
    servicesLoading,
    allServices,
    allServicesLoading,
    filteredPractitionersData,
    filteredPractitionersLoading,
    serviceTypes,
    state,
    selectPractitioner,
    selectService,
    selectServiceOnly,
  } = booking

  const [selectedType, setSelectedType] = useState<BookingType | null>(null)
  const isRtl = locale === "ar"
  const chevronIcon = isRtl ? ArrowRight01Icon : ArrowLeft01Icon

  const availableTypes = serviceTypes
    .filter((st) => st.isActive && st.bookingType !== "walk_in")
    .map((st) => st.bookingType as Exclude<BookingType, "walk_in">)

  function handleServiceSelect(svc: Service | null) {
    if (!selectedType || !svc) return
    selectService(svc, selectedType)
  }

  /* ─── practitioner_first flow ─── */

  if (flowOrder === "practitioner_first") {
    /* Step 1: Select Practitioner */
    if (!state.practitioner) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الطبيب أو المعالج" : "Choose a practitioner"}
          </p>
          {practitionersLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {(practitionersData?.items ?? []).map((p: Practitioner) => (
                <button
                  key={p.id}
                  onClick={() => selectPractitioner(p)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border border-border/60",
                    "hover:border-primary/60 hover:bg-primary/5 transition-all text-start",
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-primary font-semibold text-sm">
                        {p.user.firstName?.[0] ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isRtl && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isRtl && p.specialtyAr ? p.specialtyAr : p.specialty}
                    </p>
                  </div>
                  <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    /* Step 2: Select Service (practitioner_first) */
    if (!state.service) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الخدمة" : "Choose a service"}
          </p>
          {servicesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((svc: Service) => (
                <div key={svc.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => booking.setState((s) => ({ ...s, service: svc }))}
                    className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <div>
                      <p className="font-medium text-sm">{isRtl ? svc.nameAr : svc.nameEn}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                      </p>
                    </div>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  /* ─── service_first flow ─── */

  if (flowOrder === "service_first") {
    /* Step 1: Select Service */
    if (!state.service) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الخدمة" : "Choose a service"}
          </p>
          {allServicesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {allServices.map((svc: Service) => (
                <div key={svc.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => selectServiceOnly(svc)}
                    className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <div>
                      <p className="font-medium text-sm">{isRtl ? svc.nameAr : svc.nameEn}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                      </p>
                    </div>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    /* Step 2: Select Practitioner (service_first — filtered) */
    if (!state.practitioner) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الطبيب أو المعالج" : "Choose a practitioner"}
          </p>
          {filteredPractitionersLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {(filteredPractitionersData?.items ?? []).map((p: Practitioner) => (
                <button
                  key={p.id}
                  onClick={() => selectPractitioner(p)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border border-border/60",
                    "hover:border-primary/60 hover:bg-primary/5 transition-all text-start",
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-primary font-semibold text-sm">
                        {p.user.firstName?.[0] ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isRtl && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isRtl && p.specialtyAr ? p.specialtyAr : p.specialty}
                    </p>
                  </div>
                  <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  /* ─── Shared: booking type selection (both flows) ─── */

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {isRtl ? "اختر نوع الزيارة" : "Choose visit type"}
      </p>
      <div className="space-y-2">
        {availableTypes.map((type) => {
          const config = BOOKING_TYPE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start",
                selectedType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <span>{config.icon}</span>
              <span className="text-sm font-medium">
                {isRtl ? config.labelAr : config.labelEn}
              </span>
              {selectedType === type && (
                <Badge variant="default" className="ms-auto text-xs">
                  {isRtl ? "محدد" : "Selected"}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
      <Button
        className="w-full"
        disabled={!selectedType}
        onClick={() => handleServiceSelect(state.service)}
      >
        {isRtl ? "التالي" : "Next"}
      </Button>
    </div>
  )
}
