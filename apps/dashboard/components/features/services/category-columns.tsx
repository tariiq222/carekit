"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ServiceCategory } from "@/lib/types/service"

type TFn = (key: string) => string

export function getCategoryColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (c: ServiceCategory) => void,
  onDelete?: (c: ServiceCategory) => void,
): ColumnDef<ServiceCategory>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("services.categories.col.name", "Category"),
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original
        const primary = locale === "ar" ? c.nameAr : (c.nameEn ?? c.nameAr)
        const secondary = locale === "ar" ? c.nameEn : c.nameAr
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{primary}</span>
            {secondary && primary !== secondary && (
              <span className="text-xs text-muted-foreground">{secondary}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "services",
      header: label("services.categories.col.services", "Services"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original._count?.services ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: label("services.categories.col.order", "Sort Order"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">{row.original.sortOrder}</span>
      ),
    },
    {
      id: "status",
      header: label("services.categories.col.status", "Status"),
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
            ? label("services.categories.status.active", "Active")
            : label("services.categories.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original
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
              <DropdownMenuItem onClick={() => onEdit?.(c)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("services.categories.action.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(c)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {label("services.categories.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
