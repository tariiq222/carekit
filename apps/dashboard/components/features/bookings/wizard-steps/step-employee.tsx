"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployees } from "@/lib/api/employees"
import type { Employee } from "@/lib/types/employee"

/* ─── Helpers ─── */

function getEmployeeNameFromFull(p: Employee, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr
  return `${p.user.firstName} ${p.user.lastName}`.trim()
}

/* ─── Skeleton ─── */

function StepEmployeeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Avatar ─── */

interface EmployeeAvatarProps {
  avatarUrl: string | null | undefined
  name: string
}

function EmployeeAvatar({ avatarUrl, name }: EmployeeAvatarProps) {
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

interface StepEmployeeProps {
  serviceId: string
  onSelect: (employeeId: string, employeeName: string) => void
}

export function StepEmployee({ serviceId: _serviceId, onSelect }: StepEmployeeProps) {
  const { t, locale } = useLocale()

  const { data: allEmployees, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchEmployees({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  if (loadingAll) return <StepEmployeeSkeleton />

  const employees = (allEmployees?.items ?? []).filter((p) => p.isActive)

  return (
    <div className="flex flex-col gap-2">
      {employees.map((p) => {
        const name = getEmployeeNameFromFull(p, locale)
        const title = p.title ?? ""

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.id, name)}
            className="py-3 px-5"
          >
            <div className="flex items-center gap-3">
              <EmployeeAvatar avatarUrl={p.avatarUrl} name={name} />
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

      {employees.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("bookings.wizard.noEmployees")}
        </p>
      )}
    </div>
  )
}
