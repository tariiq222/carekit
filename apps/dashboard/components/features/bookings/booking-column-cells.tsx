"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon, ViewIcon, PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/features/status-badge"
import { cn } from "@/lib/utils"
import type { Booking } from "@/lib/types/booking"

/* Quick status actions available per status */
const quickStatusActions: Record<string, {
  action: "confirm" | "noshow"
  label: string
  icon: typeof Tick01Icon
  destructive?: boolean
}[]> = {
  pending:   [{ action: "confirm", label: "تأكيد الحجز", icon: Tick01Icon }],
  confirmed: [],
}

/* ── Delete confirm dialog (self-contained per row) ── */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  t,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
  t: (key: string) => string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bookings.col.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bookings.col.deleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ── Actions cell (icon buttons + delete dialog) ── */
export function ActionsCell({
  booking: _booking,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  booking: Booking
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const btnBase = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

  return (
    <>
      <div className="flex items-center gap-1">
        <button className={btnBase} aria-label={t("bookings.col.view")} onClick={onView}>
          <HugeiconsIcon icon={ViewIcon} size={16} />
        </button>
        <button className={btnBase} aria-label={t("bookings.col.edit")} onClick={onEdit}>
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
        </button>
        <button
          className={cn(btnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
          aria-label={t("bookings.col.delete")}
          onClick={() => setDeleteOpen(true)}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </button>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          setDeleteOpen(false)
          onDelete()
        }}
        t={t}
      />
    </>
  )
}

/* ── Status cell with quick-action dropdown ── */
export function StatusCell({
  booking,
  onStatusAction,
}: {
  booking: Booking
  onStatusAction: (booking: Booking, action: "confirm" | "noshow") => void
}) {
  const actions = quickStatusActions[booking.status]
  if (!actions?.length) return <StatusBadge status={booking.status} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <StatusBadge status={booking.status} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {actions.map(({ action, label, icon, destructive }) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => onStatusAction(booking, action)}
            className={destructive ? "text-destructive focus:text-destructive focus:bg-destructive/10" : ""}
          >
            <HugeiconsIcon icon={icon} size={15} className="me-2 shrink-0" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
