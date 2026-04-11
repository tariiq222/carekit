"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Delete02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import type { GiftCard } from "@/lib/types/gift-card"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"

type TFn = (key: string) => string

export function getGiftCardColumns(
  locale: "en" | "ar" = "en",
  onView?: (c: GiftCard) => void,
  onEdit?: (c: GiftCard) => void,
  onDeactivate?: (c: GiftCard) => void,
  t?: TFn,
): ColumnDef<GiftCard>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      accessorKey: "code",
      header: label("giftCards.col.code", "Code"),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold text-foreground">
          {row.original.code}
        </span>
      ),
    },
    {
      id: "initialAmount",
      header: label("giftCards.col.initialAmount", "Initial"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          <FormattedCurrency amount={row.original.initialAmount} locale={locale} decimals={2} />
        </span>
      ),
    },
    {
      id: "balance",
      header: label("giftCards.col.balance", "Balance"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium text-foreground">
          <FormattedCurrency amount={row.original.balance} locale={locale} decimals={2} />
        </span>
      ),
    },
    {
      id: "spent",
      header: label("giftCards.col.spent", "Spent"),
      cell: ({ row }) => {
        const spent = row.original.initialAmount - row.original.balance
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            <FormattedCurrency amount={spent} locale={locale} decimals={2} />
          </span>
        )
      },
    },
    {
      id: "status",
      header: label("giftCards.col.status", "Status"),
      cell: ({ row }) => {
        const c = row.original
        const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date()
        const isDepleted = c.balance <= 0 && c.isActive

        if (isExpired) {
          return (
            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
              {label("giftCards.status.expired", "Expired")}
            </Badge>
          )
        }
        if (isDepleted) {
          return (
            <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground">
              {label("giftCards.status.depleted", "Depleted")}
            </Badge>
          )
        }
        return (
          <Badge
            variant="outline"
            className={
              c.isActive
                ? "border-success/30 bg-success/10 text-success"
                : "border-muted-foreground/30 bg-muted text-muted-foreground"
            }
          >
            {c.isActive
              ? label("giftCards.status.active", "Active")
              : label("giftCards.status.inactive", "Inactive")}
          </Badge>
        )
      },
    },
    {
      id: "createdAt",
      header: label("giftCards.col.created", "Created"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "PP", {
            locale: locale === "ar" ? ar : undefined,
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-solid">
              <DropdownMenuItem onClick={() => onView?.(c)}>
                <HugeiconsIcon icon={ViewIcon} size={14} />
                {label("giftCards.action.view", "View")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(c)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("giftCards.action.edit", "Edit")}
              </DropdownMenuItem>
              {c.isActive && (
                <DropdownMenuItem
                  onClick={() => onDeactivate?.(c)}
                  className="text-destructive focus:text-destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} />
                  {label("giftCards.action.deactivate", "Deactivate")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
