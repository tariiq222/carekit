"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServices } from "@/lib/api/services"
import type { Service } from "@/lib/types/service"
import { cn } from "@/lib/utils"

/* ─── Meta text builder ─── */

function buildMeta(
  service: Service,
  t: (key: string) => string,
): string {
  const parts: string[] = []

  // Duration
  if (!service.hideDurationOnBooking) {
    parts.push(`${service.durationMins} ${t("bookings.wizard.step.typeDuration.minutes")}`)
  }

  // Price
  if (!service.hidePriceOnBooking) {
    const currency = t("bookings.wizard.step.service.currency")
    const price = Math.floor(service.price / 100)
    parts.push(`${price} ${currency}`)
  }

  return parts.join(" · ")
}

/* ─── Skeleton ─── */

function StepServiceSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Step component ─── */

interface StepServiceProps {
  onSelect: (serviceId: string, serviceName: string) => void
}

export function StepService({ onSelect }: StepServiceProps) {
  const { t, locale } = useLocale()
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchServices({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const services = useMemo(() => {
    const all = data?.items ?? []
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        (s.nameEn ?? "").toLowerCase().includes(q),
    )
  }, [data, search])

  if (isLoading) return <StepServiceSkeleton />

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            locale === "ar" ? "right-4" : "left-4",
          )}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("bookings.wizard.step.service.search")}
          className={cn(
            "h-12 w-full rounded-2xl border border-border bg-surface text-sm text-foreground",
            "placeholder:text-muted-foreground outline-none",
            "focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all",
            locale === "ar" ? "pr-12 pl-4" : "pl-12 pr-4",
          )}
        />
      </div>

      {/* Service list */}
      <div className="flex flex-col gap-3">
        {services.map((service) => {
          const name = locale === "ar" ? service.nameAr : (service.nameEn ?? service.nameAr)
          const meta = buildMeta(service, t)

          return (
            <WizardCard key={service.id} onClick={() => onSelect(service.id, name)}>
              <div className="flex items-center gap-4">
                {/* Icon — RTL: shown on the right */}
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: service.iconBgColor
                      ? `${service.iconBgColor}20`
                      : "hsl(var(--primary) / 0.12)",
                  }}
                >
                  <HugeiconsIcon
                    icon={Stethoscope02Icon}
                    size={26}
                    style={{
                      color: service.iconBgColor ?? "hsl(var(--primary))",
                    }}
                  />
                </div>

                {/* Name + meta */}
                <div className="flex flex-col gap-1 min-w-0 flex-1 text-end">
                  <span className="text-base font-bold text-foreground leading-snug">
                    {name}
                  </span>
                  {meta && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {meta}
                    </span>
                  )}
                </div>
              </div>
            </WizardCard>
          )
        })}
      </div>
    </div>
  )
}
