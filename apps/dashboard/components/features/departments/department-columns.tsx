"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@carekit/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@carekit/ui"
import type { Department } from "@/lib/types/department"

type TFn = (key: string) => string

export function getDepartmentColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (d: Department) => void,
  onDelete?: (d: Department) => void,
): ColumnDef<Department>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("departments.col.name", "Name"),
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original
        const primary = locale === "ar" ? d.nameAr : d.nameEn
        const secondary = locale === "ar" ? d.nameEn : d.nameAr
        return (
          <div className="flex max-w-[280px] flex-col">
            <span
              className="truncate font-medium text-foreground"
              title={primary ?? undefined}
            >
              {primary}
            </span>
            <span
              className="truncate text-xs text-muted-foreground"
              title={secondary ?? undefined}
            >
              {secondary}
            </span>
          </div>
        )
      },
    },
    {
      id: "categories",
      header: label("departments.col.categories", "Categories"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original._count?.categories ?? 0}
        </span>
      ),
    },
    {
      id: "status",
      header: label("departments.col.status", "Status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive
            ? label("departments.status.active", "Active")
            : label("departments.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const d = row.original
        return (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                    <span className="sr-only">{label("common.actions", "Actions")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">{label("common.actions", "Actions")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="glass-solid">
              <DropdownMenuItem onClick={() => onEdit?.(d)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("departments.action.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(d)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {label("departments.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
