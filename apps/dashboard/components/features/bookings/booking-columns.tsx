"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Avatar, AvatarFallback } from "@carekit/ui"
import { cn, formatClinicDate, formatClinicTime } from "@/lib/utils"
import type { DateFormat, TimeFormat } from "@/lib/utils"
import type { Booking } from "@/lib/types/booking"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { ActionsCell, StatusCell } from "@/components/features/bookings/booking-column-cells"

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

const avatarGradients = [
  "from-avatar-1-from to-avatar-1-to",
  "from-avatar-2-from to-avatar-2-to",
  "from-avatar-3-from to-avatar-3-to",
  "from-avatar-4-from to-avatar-4-to",
  "from-avatar-5-from to-avatar-5-to",
  "from-avatar-6-from to-avatar-6-to",
  "from-avatar-7-from to-avatar-7-to",
  "from-avatar-8-from to-avatar-8-to",
]

function getGradient(name: string): string {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return avatarGradients[Math.abs(hash) % avatarGradients.length]
}

const typeConfig: Record<string, { dot: string; label: string }> = {
  in_person:           { dot: "bg-primary",          label: "زيارة حضورية"    },
  online:              { dot: "bg-accent",            label: "عن بعد"          },
  walk_in:             { dot: "bg-success",           label: "زيارة مباشرة"    },
}

/* ── Column definitions ── */

export function getBookingColumns(
  onRowClick: (booking: Booking) => void,
  onEditClick: (booking: Booking) => void,
  onStatusAction: (booking: Booking, action: "confirm" | "noshow") => void,
  onDelete: (booking: Booking) => void,
  t: (key: string) => string,
): ColumnDef<Booking>[] {
  return [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ row }) => (
        <span className="text-[13px] font-medium font-numeric text-muted-foreground">
          #{row.original.id.slice(0, 8)}
        </span>
      ),
    },
    {
      id: "client",
      header: "المريض",
      cell: ({ row }) => {
        const p = row.original.client
        if (!p) return <span className="text-muted-foreground">—</span>
        const name = `${p.firstName} ${p.lastName}`
        const grad = getGradient(name)
        return (
          <button
            className="flex items-center gap-2.5 text-start hover:opacity-80 transition-opacity"
            onClick={() => onRowClick(row.original)}
          >
            <Avatar className="size-8">
              <AvatarFallback className={cn("bg-gradient-to-br text-primary-foreground text-[11px] font-semibold", grad)}>
                {getInitials(p.firstName, p.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{name}</p>
              <p className="text-[11px] font-numeric text-muted-foreground">
                #{row.original.id.slice(0, 8)}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      id: "employee",
      header: "الممارس",
      cell: ({ row }) => {
        const u = row.original.employee?.user
        if (!u) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm font-medium text-foreground">
            د. {u.firstName} {u.lastName}
          </span>
        )
      },
    },
    {
      accessorKey: "type",
      header: "النوع",
      cell: ({ row }) => {
        const cfg = typeConfig[row.original.type] ?? { dot: "bg-muted-foreground", label: row.original.type }
        return (
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", cfg.dot)} />
            <span className="text-[13px] font-medium text-foreground">{cfg.label}</span>
          </div>
        )
      },
    },
    {
      id: "datetime",
      header: "التاريخ والوقت",
      // TODO: pass dateFormat/timeFormat from parent when columns accept config
      cell: ({ row }) => (
        <div className="font-numeric">
          <p className="text-sm font-medium text-foreground">
            {formatClinicDate(row.original.date)}
          </p>
          <p className="text-xs text-muted-foreground">{formatClinicTime(row.original.startTime)}</p>
        </div>
      ),
    },
    {
      id: "amount",
      header: "المبلغ",
      cell: ({ row }) => {
        const payment = row.original.payment
        if (!payment) return <span className="text-muted-foreground">—</span>
        return <FormattedCurrency amount={payment.totalAmount} locale="ar" decimals={2} />
      },
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ row }) => (
        <StatusCell booking={row.original} onStatusAction={onStatusAction} />
      ),
    },
    {
      id: "actions",
      header: "إجراءات",
      cell: ({ row }) => (
        <ActionsCell
          booking={row.original}
          onView={() => onRowClick(row.original)}
          onEdit={() => onEditClick(row.original)}
          onDelete={() => onDelete(row.original)}
          t={t}
        />
      ),
    },
  ]
}
