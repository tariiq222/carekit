"use client"

// Widget Service Step — supports employee_first and service_first flows

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
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
import type { Employee } from "@/lib/types/employee"
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
  anyEmployee?: boolean
  onNext?: (type: BookingType) => void
}

export function WidgetServiceStep({ locale, booking, flowOrder, anyEmployee = false, onNext }: Props) {
  const {
    employeesData,
    employeesLoading,
    services,
    servicesLoading,
    allServices,
    allServicesLoading,
    filteredEmployeesData,
    filteredEmployeesLoading,
    serviceTypes,
    state,
    selectEmployee,
    selectService,
    selectServiceOnly,
    clearEmployee,
    clearService,
    clearServiceOnly,
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

  function renderEmployeeList(employees: Employee[], loading: boolean) {
    if (loading) return <div className="flex justify-center py-8"><HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" /></div>
    return (
      <div className="space-y-2">
        {employees.map((p) => (
          <button key={p.id} onClick={() => selectEmployee(p)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl border border-border/60", "hover:border-primary/60 hover:bg-primary/5 transition-all text-start")}>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="text-primary font-semibold text-sm">{p.user.firstName?.[0] ?? "?"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{isRtl && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`}</p>
              <p className="text-xs text-muted-foreground truncate">{isRtl && p.specialtyAr ? p.specialtyAr : p.specialty}</p>
            </div>
            <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    )
  }

  /* ─── employee_first flow ─── */

  if (flowOrder === "employee_first") {
    /* Step 1: Select Employee */
    if (!state.employee) {
      return (
        <div className="space-y-3">
{renderEmployeeList(employeesData?.items ?? [], employeesLoading)}
        </div>
      )
    }

    /* Step 2: Select Service (employee_first) */
    if (!state.service) {
      return (
        <div className="space-y-3">
{servicesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((svc: Service) => (
                <div key={svc.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => selectServiceOnly(svc)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <p className="font-medium text-sm flex-1 min-w-0 truncate">{isRtl ? svc.nameAr : svc.nameEn}</p>
                    <p className="text-xs text-muted-foreground shrink-0 font-numeric">
                      {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                    </p>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground shrink-0" />
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
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <p className="font-medium text-sm flex-1 min-w-0 truncate">{isRtl ? svc.nameAr : svc.nameEn}</p>
                    <p className="text-xs text-muted-foreground shrink-0 font-numeric">
                      {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                    </p>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    /* Step 2: Select Employee (service_first — filtered) */
    if (!state.employee) {
      return (
        <div className="space-y-3">
{anyEmployee && (
            <button
              onClick={() => selectEmployee({ id: "any", user: { firstName: isRtl ? "أي" : "Any", lastName: isRtl ? "معالج" : "Employee" } } as Parameters<typeof selectEmployee>[0])}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-start"
            >
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-lg">✦</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-primary">{isRtl ? "أي معالج متاح" : "Any available employee"}</p>
                <p className="text-xs text-muted-foreground">{isRtl ? "أقرب موعد متاح" : "Earliest available slot"}</p>
              </div>
            </button>
          )}
          {renderEmployeeList(filteredEmployeesData?.items ?? [], filteredEmployeesLoading)}
        </div>
      )
    }
  }

  /* ─── Shared: booking type selection (both flows) ─── */

  const handleBookingTypeBack = flowOrder === "service_first" ? clearEmployee : clearServiceOnly

  return (
    <div className="space-y-3">
<div className="space-y-2">
        {availableTypes.map((type) => {
          const config = BOOKING_TYPE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type)
                if (state.service) {
                  selectService(state.service, type)
                }
              }}
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
      {/* Next handled by parent wizard footer */}
    </div>
  )
}
