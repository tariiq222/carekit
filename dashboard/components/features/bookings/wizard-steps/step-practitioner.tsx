"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServicePractitioners } from "@/lib/api/services"
import type { ServicePractitioner } from "@/lib/types/service"

/* ─── Helpers ─── */

function getPractitionerName(p: ServicePractitioner, locale: string): string {
  if (locale === "ar" && p.practitioner.nameAr) return p.practitioner.nameAr
  return `${p.practitioner.user.firstName} ${p.practitioner.user.lastName}`.trim()
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
  avatarUrl: string | null
  name: string
}

function PractitionerAvatar({ avatarUrl, name }: PractitionerAvatarProps) {
  if (avatarUrl) {
    return (
      <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="40px"
        />
      </div>
    )
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <HugeiconsIcon icon={UserIcon} size={18} className="text-primary" />
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

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.practitioners(serviceId),
    queryFn: () => fetchServicePractitioners(serviceId),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <StepPractitionerSkeleton />

  const practitioners = (data ?? []).filter((p) => p.isActive && p.practitioner.isActive)

  return (
    <div className="flex flex-col gap-2">
      {practitioners.map((p) => {
        const name = getPractitionerName(p, locale)
        const title = p.practitioner.title ?? ""

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.practitioner.id, name)}
          >
            <div className="flex items-center gap-3">
              <PractitionerAvatar avatarUrl={p.practitioner.avatarUrl} name={name} />

              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-foreground leading-tight truncate w-full">
                  {name}
                </span>
                {title && (
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {title}
                  </span>
                )}
              </div>
            </div>
          </WizardCard>
        )
      })}

      {!isLoading && practitioners.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("bookings.wizard.stepLabel.practitioner")}
        </p>
      )}
    </div>
  )
}
