"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, ArrowRight01Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useServicePractitioners } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { AssignPractitionersDialog } from "@/components/features/services/assign-practitioners-dialog"
import { useQuery } from "@tanstack/react-query"
import { fetchPractitioners } from "@/lib/api/practitioners"
import { queryKeys } from "@/lib/query-keys"

interface Props {
  serviceId?: string
  isCreate?: boolean
  pendingIds?: string[]
  onPendingChange?: (ids: string[]) => void
}

export function ServicePractitionersTab({ serviceId, isCreate, pendingIds = [], onPendingChange }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const [dialogOpen, setDialogOpen] = useState(false)

  /* ── Edit mode: fetch assigned practitioners ── */
  const { data: practitioners, isLoading } = useServicePractitioners(isCreate ? "" : (serviceId ?? ""))

  /* ── Create mode: fetch all practitioners to resolve pending names ── */
  const { data: allPractitionersData } = useQuery({
    queryKey: queryKeys.practitioners.list({ perPage: 200, isActive: undefined }),
    queryFn: () => fetchPractitioners({ perPage: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!isCreate,
  })
  const allPractitioners = allPractitionersData?.items ?? []
  const pendingPractitioners = allPractitioners.filter((p) => pendingIds.includes(p.id))

  /* ── Edit mode helpers ── */
  const assignedPractitionerIds = practitioners?.map((p) => p.practitioner.id) ?? []

  /* ── Create mode handlers ── */
  const handleCreateAssign = (ids: string[]) => {
    onPendingChange?.([...pendingIds, ...ids])
  }

  const handleRemovePending = (id: string) => {
    onPendingChange?.(pendingIds.filter((x) => x !== id))
  }

  /* ── Loading (edit only) ── */
  if (!isCreate && isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  /* ── Create mode ── */
  if (isCreate) {
    return (
      <div className="space-y-4">
        {pendingPractitioners.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("services.practitioners.emptyTitle")}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
              {t("services.practitioners.add")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPractitioners.map((p) => {
              const fullName = `${p.user.firstName} ${p.user.lastName}`
              const displayName = isAr && p.nameAr ? p.nameAr : fullName
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                      <div className="flex size-full items-center justify-center">
                        <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                      {p.specialty && (
                        <span className="text-xs text-muted-foreground">
                          {isAr ? (p.specialtyAr || p.specialty) : p.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-error"
                    onClick={() => handleRemovePending(p.id)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <AssignPractitionersDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          serviceId=""
          excludeIds={pendingIds}
          createMode
          onCreateAssign={handleCreateAssign}
        />
      </div>
    )
  }

  /* ── Edit mode ── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("services.practitioners.editHint")}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          {t("services.practitioners.add")}
        </Button>
      </div>

      {!practitioners || practitioners.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t("services.practitioners.emptyTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("services.practitioners.emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {practitioners.map((item) => {
            const { practitioner } = item
            const fullName = `${practitioner.user.firstName} ${practitioner.user.lastName}`
            const displayName = isAr && practitioner.nameAr ? practitioner.nameAr : fullName

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                    {practitioner.avatarUrl ? (
                      <Image
                        src={practitioner.avatarUrl}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                      {!item.isActive && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {t("common.inactive")}
                        </Badge>
                      )}
                      {!practitioner.isActive && (
                        <Badge variant="outline" className="text-xs text-warning border-warning/20 bg-warning/10">
                          {t("services.practitioners.practitionerInactive")}
                        </Badge>
                      )}
                    </div>
                    {practitioner.title && (
                      <span className="text-xs text-muted-foreground">{practitioner.title}</span>
                    )}
                    {item.availableTypes.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {item.availableTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type === "in_person"
                              ? t("services.bookingTypes.clinic")
                              : t("services.bookingTypes.online")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0"
                  onClick={() => router.push(`/practitioners/${practitioner.id}/edit`)}
                >
                  {t("common.view")}
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <AssignPractitionersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        serviceId={serviceId ?? ""}
        excludeIds={assignedPractitionerIds}
      />
    </div>
  )
}
