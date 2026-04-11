"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/features/data-table"
import { StatusBadge, BookingTypeBadge } from "@/components/features/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTodayBookings } from "@/hooks/use-bookings"
import type { Booking } from "@/lib/types/booking"

const columns: ColumnDef<Booking>[] = [
  {
    id: "patient",
    header: "Patient",
    cell: ({ row }) => {
      const p = row.original.patient
      return p ? `${p.firstName} ${p.lastName}` : "—"
    },
  },
  {
    id: "practitioner",
    header: "Practitioner",
    cell: ({ row }) => {
      const u = row.original.practitioner?.user
      return u ? `${u.firstName} ${u.lastName}` : "—"
    },
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.getValue("date")}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <BookingTypeBadge type={row.getValue("type")} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  )
}

export function RecentBookings() {
  const today = new Date().toISOString().split("T")[0]
  const { data, isLoading } = useTodayBookings(today)
  const bookings = data?.items ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={bookings}
            emptyTitle="No bookings"
            emptyDescription="No bookings scheduled for today."
          />
        )}
      </CardContent>
    </Card>
  )
}
