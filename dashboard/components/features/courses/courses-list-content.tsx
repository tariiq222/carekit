"use client"

import { useRouter } from "next/navigation"
import { useCourses } from "@/hooks/use-courses"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { Course, CourseStatus, DeliveryMode } from "@/lib/types/courses"

const statusStyles: Record<CourseStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  archived: "bg-muted text-muted-foreground",
}

const deliveryModeStyles: Record<DeliveryMode, string> = {
  in_person: "bg-primary/10 text-primary border-primary/30",
  online: "bg-success/10 text-success border-success/30",
  hybrid: "bg-warning/10 text-warning border-warning/30",
}

export function CoursesListContent() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const {
    courses, meta, isLoading, error,
    search, setSearch,
    status, setStatus,
    deliveryMode, setDeliveryMode,
    resetFilters, setPage,
  } = useCourses()
  const { cancelCourseMut, deleteCourseMut } = useCoursesMutations()

  const columns: ColumnDef<Course>[] = [
    {
      accessorKey: "name",
      header: t("courses.name"),
      cell: ({ row }) => locale === "ar" ? row.original.nameAr : row.original.nameEn,
    },
    {
      accessorKey: "practitioner",
      header: t("courses.practitioner"),
      cell: ({ row }) => row.original.practitioner?.nameAr ?? "—",
    },
    {
      accessorKey: "totalSessions",
      header: t("courses.sessions"),
      cell: ({ row }) => `${row.original.totalSessions} ${t("courses.minutes") !== "دقيقة" ? "sessions" : "جلسة"}`,
    },
    {
      accessorKey: "currentEnrollment",
      header: t("courses.enrolled"),
      cell: ({ row }) => {
        const { currentEnrollment, maxParticipants, isGroup } = row.original
        if (!isGroup) return currentEnrollment
        return `${currentEnrollment}/${maxParticipants ?? "∞"}`
      },
    },
    {
      accessorKey: "deliveryMode",
      header: t("courses.deliveryMode"),
      cell: ({ row }) => {
        const mode = row.original.deliveryMode
        return <Badge className={deliveryModeStyles[mode]}>{t(`courses.deliveryMode.${mode}`)}</Badge>
      },
    },
    {
      accessorKey: "startDate",
      header: t("courses.startDateCol"),
      cell: ({ row }) =>
        new Date(row.original.startDate).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        ),
    },
    {
      accessorKey: "status",
      header: t("courses.status"),
      cell: ({ row }) => {
        const s = row.original.status
        return <Badge className={statusStyles[s]}>{t(`courses.status.${s}`)}</Badge>
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const { id, status: s } = row.original
        const canCancel = s === "published" || s === "in_progress"
        const canDelete = s === "draft"
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="size-9 rounded-sm"
                  onClick={() => router.push(`/courses/${id}`)}
                >
                  <HugeiconsIcon icon={ViewIcon} size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.view")}</TooltipContent>
            </Tooltip>
            {canCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="size-9 rounded-sm text-destructive"
                    onClick={() => cancelCourseMut.mutate(id)}
                    disabled={cancelCourseMut.isPending}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("courses.cancelCourse")}</TooltipContent>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="size-9 rounded-sm text-destructive"
                    onClick={() => deleteCourseMut.mutate(id)}
                    disabled={deleteCourseMut.isPending}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.delete")}</TooltipContent>
              </Tooltip>
            )}
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

  const statusOptions = (["draft", "published", "in_progress", "completed", "archived"] as CourseStatus[]).map((v) => ({
    value: v,
    label: t(`courses.status.${v}`),
  }))

  const deliveryOptions = (["in_person", "online", "hybrid"] as DeliveryMode[]).map((v) => ({
    value: v,
    label: t(`courses.deliveryMode.${v}`),
  }))

  return (
    <>
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("courses.searchPlaceholder"),
        }}
        selects={[
          {
            key: "status",
            value: status ?? "",
            onValueChange: (v: string) => setStatus((v || undefined) as CourseStatus | undefined),
            options: statusOptions,
            placeholder: t("courses.filterByStatus"),
          },
          {
            key: "deliveryMode",
            value: deliveryMode ?? "",
            onValueChange: (v: string) => setDeliveryMode((v || undefined) as DeliveryMode | undefined),
            options: deliveryOptions,
            placeholder: t("courses.filterByDelivery"),
          },
        ]}
        hasFilters={!!status || !!deliveryMode || !!search}
        onReset={resetFilters}
        resultCount={meta?.total}
      />

      <DataTable
        columns={columns}
        data={courses}
        emptyTitle={t("courses.noCourses")}
        emptyDescription={t("courses.noCoursesDesc")}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
            {t("common.previous")}
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {meta.page} / {meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>
            {t("common.next")}
          </Button>
        </div>
      )}
    </>
  )
}
