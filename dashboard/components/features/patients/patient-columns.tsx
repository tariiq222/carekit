"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { getInitials } from "@/lib/utils"
import {
  ViewIcon,
  PencilEdit01Icon,
  UserCheck01Icon,
  UserBlock01Icon,
  MailValidation01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Patient } from "@/lib/types/patient"

interface PatientColumnOptions {
  onRowClick: (patient: Patient) => void
  onViewClick: (patient: Patient) => void
  onEditClick: (patient: Patient) => void
  onToggleActive: (patient: Patient) => void
  t: (key: string) => string
  locale?: "ar" | "en"
}

export function getPatientColumns({
  onRowClick,
  onViewClick,
  onEditClick,
  onToggleActive,
  t,
  locale = "ar",
}: PatientColumnOptions): ColumnDef<Patient>[] {
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US"
  return [
    {
      id: "patient",
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      header: t("patients.col.patient"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const nameA = `${a.original.firstName} ${a.original.lastName}`
        const nameB = `${b.original.firstName} ${b.original.lastName}`
        return nameA.localeCompare(nameB, "ar")
      },
      cell: ({ row }) => {
        const p = row.original
        const initials = getInitials(p.firstName, p.lastName)
        return (
          <button onClick={() => onRowClick(p)} className="flex items-center gap-3 text-start">
            <Avatar className="size-8">
              {p.avatarUrl ? (
                <AvatarImage src={p.avatarUrl} alt={`${p.firstName} ${p.lastName}`} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">
                  {p.firstName} {p.lastName}
                </p>
                {p.accountType === "walk_in" && (
                  <span className="rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    {t("patients.detail.walkIn")}
                  </span>
                )}
                {p.emailVerified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center">
                        <HugeiconsIcon icon={MailValidation01Icon} size={14} className="text-success" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("patients.otpVerified")}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {p.email}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      accessorKey: "phone",
      header: t("patients.col.phone"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.phone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("patients.col.joined"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString(dateLocale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "lastBooking",
      accessorFn: (row) => row.lastBooking?.date ?? "",
      header: t("patients.col.lastBooking"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const dateA = a.original.lastBooking?.date ? new Date(a.original.lastBooking.date).getTime() : 0
        const dateB = b.original.lastBooking?.date ? new Date(b.original.lastBooking.date).getTime() : 0
        return dateA - dateB
      },
      cell: ({ row }) => {
        const b = row.original.lastBooking
        if (!b) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {new Date(b.date).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )
      },
    },
    {
      id: "nextBooking",
      accessorFn: (row) => row.nextBooking?.date ?? "",
      header: t("patients.col.nextBooking"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const dateA = a.original.nextBooking?.date ? new Date(a.original.nextBooking.date).getTime() : 0
        const dateB = b.original.nextBooking?.date ? new Date(b.original.nextBooking.date).getTime() : 0
        return dateA - dateB
      },
      cell: ({ row }) => {
        const b = row.original.nextBooking
        if (!b) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {new Date(b.date).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )
      },
    },
    {
      id: "status",
      header: t("patients.col.status"),
      enableSorting: true,
      sortingFn: (a, b) => Number(b.original.isActive) - Number(a.original.isActive),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive ? t("patients.status.active") : t("patients.status.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("patients.col.actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onViewClick(row.original)}
                aria-label={t("patients.col.view")}
                className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={ViewIcon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("patients.col.view")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEditClick(row.original)}
                aria-label={t("patients.col.edit")}
                className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("patients.col.edit")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggleActive(row.original)}
                aria-label={row.original.isActive ? t("patients.actions.deactivate") : t("patients.actions.activate")}
                className={`flex size-9 items-center justify-center rounded-sm border border-transparent transition-all duration-200 hover:border-border hover:bg-muted ${
                  row.original.isActive
                    ? "text-destructive hover:text-destructive"
                    : "text-success hover:text-success"
                }`}
              >
                <HugeiconsIcon
                  icon={row.original.isActive ? UserBlock01Icon : UserCheck01Icon}
                  size={16}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {row.original.isActive ? t("patients.actions.deactivate") : t("patients.actions.activate")}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]
}
