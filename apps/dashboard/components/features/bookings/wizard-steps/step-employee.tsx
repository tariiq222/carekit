"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServicePractitioners } from "@/lib/api/services"
import { fetchPractitioners } from "@/lib/api/practitioners"
import type { ServicePractitioner } from "@/lib/types/service"
import type { Practitioner } from "@/lib/types/practitioner"

/* ─── Helpers ─── */

function getPractitionerName(p: ServicePractitioner, locale: string): string {
  if (locale === "ar" && p.practitioner.nameAr) return p.practitioner.nameAr
  return `${p.practitioner.user.firstName} ${p.practitioner.user.lastName}`.trim()
}

function getPractitionerNameFromFull(p: Practitioner, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr
  return `${p.user.firstName} ${p.user.lastName}`.trim()
}

/* ─── Skeleton ─── */

function StepPractitionerSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Avatar ─── */

interface PractitionerAvatarProps {
  avatarUrl: string | null | undefined
  name: string
}

function PractitionerAvatar({ avatarUrl, name }: PractitionerAvatarProps) {
  if (avatarUrl) {
    return (
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>
    )
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <HugeiconsIcon icon={UserIcon} size={22} className="text-primary" />
    </div>
  )
}

/* ─── Step component ─── */

interface StepPractitionerProps {
  serviceId: string
  onSelect: (practitionerId: string, practitionerName: string) => void
}

export function StepPractitioner({ serviceId, onSelect }: StepPractitionerProps) {
  const { t, locale } = useLocale()
  const hasService = serviceId.length > 0

  /* ── Mode A: service already selected → fetch practitioners for that service ── */
  const { data: servicePractitioners, isLoading: loadingService } = useQuery({
    queryKey: queryKeys.services.practitioners(serviceId),
    queryFn: () => fetchServicePractitioners(serviceId),
    staleTime: 5 * 60 * 1000,
    enabled: hasService,
  })

  /* ── Mode B: no service yet (practitioner_first) → fetch all active practitioners ── */
  const { data: allPractitioners, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.practitioners.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchPractitioners({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: !hasService,
  })

  const isLoading = hasService ? loadingService : loadingAll

  if (isLoading) return <StepPractitionerSkeleton />

  /* ── Render Mode A: ServicePractitioner list ── */
  if (hasService) {
    const practitioners = (servicePractitioners ?? []).filter(
      (p) => p.isActive && p.practitioner.isActive,
    )

    return (
      <div className="flex flex-col gap-2">
        {practitioners.map((p) => {
          const name = getPractitionerName(p, locale)
          const title = p.practitioner.title ?? ""

          return (
            <WizardCard
              key={p.id}
              onClick={() => onSelect(p.practitioner.id, name)}
              className="py-3 px-5"
            >
              <div className="flex items-center gap-3">
                <PractitionerAvatar avatarUrl={p.practitioner.avatarUrl} name={name} />
                <div className="flex flex-col items-start gap-0.5 min-w-0">
                  <span className="text-base font-semibold text-foreground leading-tight truncate w-full">
                    {name}
                  </span>
                  {title && (
                    <span className="text-sm text-muted-foreground truncate w-full">
                      {title}
                    </span>
                  )}
                </div>
              </div>
            </WizardCard>
          )
        })}

        {practitioners.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("bookings.wizard.noPractitioners")}
          </p>
        )}
      </div>
    )
  }

  /* ── Render Mode B: full Practitioner list ── */
  const practitioners = (allPractitioners?.items ?? []).filter((p) => p.isActive)

  return (
    <div className="flex flex-col gap-2">
      {practitioners.map((p) => {
        const name = getPractitionerNameFromFull(p, locale)
        const title = p.title ?? ""

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.id, name)}
            className="py-3 px-5"
          >
            <div className="flex items-center gap-3">
              <PractitionerAvatar avatarUrl={p.avatarUrl} name={name} />
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-base font-semibold text-foreground leading-tight truncate w-full">
                  {name}
                </span>
                {title && (
                  <span className="text-sm text-muted-foreground truncate w-full">
                    {title}
                  </span>
                )}
              </div>
            </div>
          </WizardCard>
        )
      })}

      {practitioners.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("bookings.wizard.noPractitioners")}
        </p>
      )}
    </div>
  )
}
