"use client"

import { format } from "date-fns"
import { ar } from "date-fns/locale"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@carekit/ui"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import type { ActivityLog } from "@/lib/types/activity-log"

const actionStyles: Record<string, string> = {
  created: "border-success/30 bg-success/10 text-success",
  updated: "border-info/30 bg-info/10 text-info",
  deleted: "border-destructive/30 bg-destructive/10 text-destructive",
  login: "border-primary/30 bg-primary/10 text-primary",
  logout: "border-muted-foreground/30 bg-muted text-muted-foreground",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function getActivityLogColumns(
  t: (key: string) => string,
  locale: "en" | "ar" = "en",
): ColumnDef<ActivityLog>[] {
  return [
    {
      id: "user",
      header: t("activityLog.col.user"),
      cell: ({ row }) => {
        const u = row.original.user
        if (!u) return <span className="text-sm text-muted-foreground">{t("activityLog.system")}</span>
        const initials = getInitials(u.firstName, u.lastName)
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground">
              {u.firstName} {u.lastName}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "action",
      header: t("activityLog.col.action"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={actionStyles[row.original.action] ?? ""}
        >
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "module",
      header: t("activityLog.col.module"),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-[10px]">
          {row.original.module}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: t("activityLog.col.description"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "resourceId",
      header: t("activityLog.col.resource"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.resourceId?.slice(0, 8) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("activityLog.col.time"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "MMM d, yyyy HH:mm", {
            locale: locale === "ar" ? ar : undefined,
          })}
        </span>
      ),
    },
  ]
}
