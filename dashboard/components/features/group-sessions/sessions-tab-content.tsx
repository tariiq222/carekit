"use client"

import { useRouter } from "next/navigation"
import { useGroupSessions } from "@/hooks/use-group-sessions"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, ViewIcon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { GroupSession, GroupSessionStatus } from "@/lib/types/group-sessions"

const statusStyles: Record<GroupSessionStatus, string> = {
  open: "bg-primary/10 text-primary border-primary/30",
  confirmed: "bg-success/10 text-success border-success/30",
  full: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

const statusLabels: Record<GroupSessionStatus, { ar: string; en: string }> = {
  open: { ar: "مفتوح", en: "Open" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  full: { ar: "مكتمل", en: "Full" },
  completed: { ar: "منتهي", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
}

export function SessionsTabContent() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const {
    sessions, meta, isLoading, error,
    status, setStatus,
    resetFilters,
  } = useGroupSessions()
  const { cancelSessionMut } = useGroupSessionsMutations()

  const columns: ColumnDef<GroupSession>[] = [
    {
      accessorKey: "groupOffering",
      header: t("groupSessions.offering"),
      cell: ({ row }) => {
        const offering = row.original.groupOffering
        return locale === "ar" ? offering?.nameAr : offering?.nameEn
      },
    },
    {
      accessorKey: "startTime",
      header: t("groupSessions.date"),
      cell: ({ row }) =>
        new Date(row.original.startTime).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
        ),
    },
    {
      accessorKey: "currentEnrollment",
      header: t("groupSessions.enrolled"),
      cell: ({ row }) => {
        const max = row.original.groupOffering?.maxParticipants ?? 0
        return `${row.original.currentEnrollment}/${max}`
      },
    },
    {
      accessorKey: "status",
      header: t("groupSessions.status"),
      cell: ({ row }) => {
        const s = row.original.status
        const label = locale === "ar" ? statusLabels[s].ar : statusLabels[s].en
        return <Badge className={statusStyles[s]}>{label}</Badge>
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-sm"
                onClick={() => router.push(`/group-sessions/${row.original.id}`)}
              >
                <HugeiconsIcon icon={ViewIcon} size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.view")}</TooltipContent>
          </Tooltip>
          {row.original.status !== "completed" && row.original.status !== "cancelled" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-sm text-destructive"
                  onClick={() => cancelSessionMut.mutate(row.original.id)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("groupSessions.cancelSession")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorBanner message={error} />

  const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
    value,
    label: locale === "ar" ? label.ar : label.en,
  }))

  return (
    <>
      <FilterBar
        search=""
        selects={[
          {
            value: status ?? "",
            onChange: (v: string) => setStatus((v || undefined) as GroupSessionStatus | undefined),
            options: statusOptions,
            placeholder: t("groupSessions.filterByStatus"),
          },
        ]}
        hasFilters={!!status}
        onReset={resetFilters}
        resultCount={meta?.total}
      />

      <DataTable
        columns={columns}
        data={sessions}
        emptyTitle={t("groupSessions.noSessions")}
        emptyDescription={t("groupSessions.noSessionsDesc")}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {t("common.page")} {meta.page} / {meta.totalPages}
          </p>
        </div>
      )}
    </>
  )
}
