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
import { Cancel01Icon, ViewIcon, Delete02Icon } from "@hugeicons/core-free-icons"
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

export function SessionsListContent() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const {
    sessions, meta, isLoading, error,
    search, setSearch,
    status, setStatus,
    visibility, setVisibility,
    resetFilters,
  } = useGroupSessions()
  const { cancelSessionMut, deleteSessionMut } = useGroupSessionsMutations()

  const columns: ColumnDef<GroupSession>[] = [
    {
      accessorKey: "name",
      header: t("groupSessions.name"),
      cell: ({ row }) => locale === "ar" ? row.original.nameAr : row.original.nameEn,
    },
    {
      accessorKey: "practitioner",
      header: t("groupSessions.practitioner"),
      cell: ({ row }) => row.original.practitioner?.nameAr ?? "—",
    },
    {
      accessorKey: "schedulingMode",
      header: t("groupSessions.type"),
      cell: ({ row }) => {
        const mode = row.original.schedulingMode
        return mode === "fixed_date"
          ? (locale === "ar" ? "تاريخ محدد" : "Fixed Date")
          : (locale === "ar" ? "عند الاكتمال" : "On Capacity")
      },
    },
    {
      accessorKey: "startTime",
      header: t("groupSessions.date"),
      cell: ({ row }) => {
        const st = row.original.startTime
        if (!st) return locale === "ar" ? "بانتظار التاريخ" : "Pending"
        return new Date(st).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
        )
      },
    },
    {
      accessorKey: "currentEnrollment",
      header: t("groupSessions.enrolled"),
      cell: ({ row }) => `${row.original.currentEnrollment}/${row.original.maxParticipants}`,
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
      accessorKey: "isPublished",
      header: t("groupSessions.published"),
      cell: ({ row }) => (
        <Badge variant={row.original.isPublished ? "default" : "secondary"}>
          {row.original.isPublished
            ? (locale === "ar" ? "منشورة" : "Published")
            : (locale === "ar" ? "مسودة" : "Draft")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const canAct = row.original.status !== "completed" && row.original.status !== "cancelled"
        return (
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
            {canAct && (
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-sm text-destructive"
                  onClick={() => deleteSessionMut.mutate(row.original.id)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
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

  const visibilityOptions = [
    { value: "published", label: locale === "ar" ? "منشورة" : "Published" },
    { value: "draft", label: locale === "ar" ? "مسودة" : "Draft" },
  ]

  return (
    <>
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("groupSessions.searchPlaceholder"),
        }}
        selects={[
          {
            key: "status",
            value: status ?? "",
            onValueChange: (v: string) => setStatus((v || undefined) as GroupSessionStatus | undefined),
            options: statusOptions,
            placeholder: t("groupSessions.filterByStatus"),
          },
          {
            key: "visibility",
            value: visibility ?? "",
            onValueChange: (v: string) => setVisibility((v || undefined) as "published" | "draft" | undefined),
            options: visibilityOptions,
            placeholder: t("groupSessions.filterByVisibility"),
          },
        ]}
        hasFilters={!!status || !!visibility || !!search}
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
