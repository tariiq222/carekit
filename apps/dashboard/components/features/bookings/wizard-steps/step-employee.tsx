"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServiceEmployees } from "@/lib/api/services"
import { fetchEmployees } from "@/lib/api/employees"
import type { ServiceEmployee } from "@/lib/types/service"
import type { Employee } from "@/lib/types/employee"

/* ─── Helpers ─── */

function getEmployeeName(p: ServiceEmployee, locale: string): string {
  if (locale === "ar" && p.employee.nameAr) return p.employee.nameAr
  return `${p.employee.user.firstName} ${p.employee.user.lastName}`.trim()
}

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

export function StepEmployee({ serviceId, onSelect }: StepEmployeeProps) {
  const { t, locale } = useLocale()
  const hasService = serviceId.length > 0

  /* ── Mode A: service already selected → fetch employees for that service ── */
  const { data: serviceEmployees, isLoading: loadingService } = useQuery({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    staleTime: 5 * 60 * 1000,
    enabled: hasService,
  })

  /* ── Mode B: no service yet (employee_first) → fetch all active employees ── */
  const { data: allEmployees, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchEmployees({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: !hasService,
  })

  const isLoading = hasService ? loadingService : loadingAll

  if (isLoading) return <StepEmployeeSkeleton />

  /* ── Render Mode A: ServiceEmployee list ── */
  if (hasService) {
    const employees = (serviceEmployees ?? []).filter(
      (p) => p.isActive && p.employee.isActive,
    )

    return (
      <div className="flex flex-col gap-2">
        {employees.map((p) => {
          const name = getEmployeeName(p, locale)
          const title = p.employee.title ?? ""

          return (
            <WizardCard
              key={p.id}
              onClick={() => onSelect(p.employee.id, name)}
              className="py-3 px-5"
            >
              <div className="flex items-center gap-3">
                <EmployeeAvatar avatarUrl={p.employee.avatarUrl} name={name} />
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

  /* ── Render Mode B: full Employee list ── */
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
