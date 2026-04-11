"use client"

import { useState } from "react"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, ViewIcon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import type { Group, GroupStatus, DeliveryMode } from "@/lib/types/groups"

const statusStyles: Record<GroupStatus, string> = {
  open: "bg-primary/10 text-primary border-primary/30",
  awaiting_payment: "bg-warning/10 text-warning border-warning/30",
  confirmed: "bg-success/10 text-success border-success/30",
  full: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

const statusLabels: Record<GroupStatus, { ar: string; en: string }> = {
  open: { ar: "مفتوح", en: "Open" },
  awaiting_payment: { ar: "بانتظار الدفع", en: "Awaiting Payment" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  full: { ar: "مكتمل", en: "Full" },
  completed: { ar: "منتهي", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
}

interface GroupsListContentProps {
  groups: Group[]
  meta: { total: number; page: number; totalPages: number } | null
  isLoading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  status: GroupStatus | undefined
  setStatus: (v: GroupStatus | undefined) => void
  deliveryMode: DeliveryMode | undefined
  setDeliveryMode: (v: DeliveryMode | undefined) => void
  visibility: "published" | "draft" | undefined
  setVisibility: (v: "published" | "draft" | undefined) => void
  resetFilters: () => void
  onGroupClick: (id: string) => void
}

export function GroupsListContent({
  groups, meta, isLoading, error,
  search, setSearch,
  status, setStatus,
  deliveryMode, setDeliveryMode,
  visibility, setVisibility,
  resetFilters,
  onGroupClick,
}: GroupsListContentProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const { cancelGroupMut, deleteGroupMut } = useGroupsMutations()

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  const columns: ColumnDef<Group>[] = [
    {
      accessorKey: "name",
      header: t("groups.name"),
      cell: ({ row }) => locale === "ar" ? row.original.nameAr : row.original.nameEn,
    },
    {
      accessorKey: "employee",
      header: t("groups.employee"),
      cell: ({ row }) => row.original.employee?.nameAr ?? "—",
    },
    {
      accessorKey: "deliveryMode",
      header: t("groups.deliveryMode"),
      cell: ({ row }) => {
        const modes: Record<DeliveryMode, { ar: string; en: string }> = {
          in_person: { ar: "حضوري", en: "In-Person" },
          online: { ar: "أونلاين", en: "Online" },
        }
        const mode = row.original.deliveryMode
        return locale === "ar" ? modes[mode].ar : modes[mode].en
      },
    },
    {
      accessorKey: "startTime",
      header: t("groups.date"),
      cell: ({ row }) => {
        const st = row.original.startTime
        if (!st) return locale === "ar" ? "بانتظار التاريخ" : "Pending"
        return new Date(st).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        )
      },
    },
    {
      accessorKey: "currentEnrollment",
      header: t("groups.enrolled"),
      cell: ({ row }) => `${row.original.currentEnrollment}/${row.original.maxParticipants}`,
    },
    {
      accessorKey: "status",
      header: t("groups.status"),
      cell: ({ row }) => {
        const s = row.original.status
        const label = locale === "ar" ? statusLabels[s].ar : statusLabels[s].en
        return <Badge className={statusStyles[s]}>{label}</Badge>
      },
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
                  onClick={() => router.push(`/groups/${row.original.id}/edit`)}
                >
                  <HugeiconsIcon icon={Edit02Icon} size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-sm"
                  onClick={() => onGroupClick(row.original.id)}
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
                    onClick={() => setCancelTarget(row.original.id)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("groups.cancelGroup")}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-sm text-destructive"
                  onClick={() => setDeleteTarget(row.original.id)}
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

  const statusOptions = (Object.entries(statusLabels) as Array<[GroupStatus, { ar: string; en: string }]>).map(([value, label]) => ({
    value,
    label: locale === "ar" ? label.ar : label.en,
  }))

  const deliveryOptions = [
    { value: "in_person", label: locale === "ar" ? "حضوري" : "In-Person" },
    { value: "online", label: locale === "ar" ? "أونلاين" : "Online" },
  ]

  return (
    <>
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("groups.searchPlaceholder"),
        }}
        selects={[
          {
            key: "status",
            value: status ?? "",
            onValueChange: (v: string) => setStatus((v || undefined) as GroupStatus | undefined),
            options: statusOptions,
            placeholder: t("groups.filterByStatus"),
          },
          {
            key: "deliveryMode",
            value: deliveryMode ?? "",
            onValueChange: (v: string) => setDeliveryMode((v || undefined) as DeliveryMode | undefined),
            options: deliveryOptions,
            placeholder: t("groups.filterByDelivery"),
          },
        ]}
        hasFilters={!!status || !!deliveryMode || !!visibility || !!search}
        onReset={resetFilters}
        resultCount={meta?.total}
      />

      <DataTable
        columns={columns}
        data={groups}
        emptyTitle={t("groups.noGroups")}
        emptyDescription={t("groups.noGroupsDesc")}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("groups.delete.confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteGroupMut.mutate(deleteTarget); setDeleteTarget(null) }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.cancel.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("groups.cancel.confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (cancelTarget) cancelGroupMut.mutate(cancelTarget); setCancelTarget(null) }}
            >
              {t("groups.cancelGroup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
