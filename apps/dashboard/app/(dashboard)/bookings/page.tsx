"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { BookingDetailSheet } from "@/components/features/bookings/booking-detail-sheet"
import { BookingCreateDialog } from "@/components/features/bookings/booking-create-dialog"
import { ProblemReportsTab } from "@/components/features/bookings/problem-reports-tab"
import { WaitlistTab } from "@/components/features/bookings/waitlist-tab"
import { BookingsTabContent } from "@/components/features/bookings/bookings-tab-content"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingSettings } from "@/lib/api/booking-settings"
import { useLocale } from "@/components/locale-provider"
import type { Booking } from "@/lib/types/booking"

export default function BookingsPage() {
  return <Suspense><BookingsPageInner /></Suspense>
}

function BookingsPageInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const defaultTab = tabParam === "problemReports" ? "problemReports" : tabParam === "waitlist" ? "waitlist" : "bookings"
  const { t } = useLocale()
  const queryClient = useQueryClient()

  const { data: bookingSettings } = useQuery({
    queryKey: queryKeys.bookingSettings.detail(),
    queryFn: fetchBookingSettings,
    staleTime: 5 * 60 * 1000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailDefaultTab, setDetailDefaultTab] = useState<"details" | "reschedule">("details")

  const handleRowClick = (booking: Booking) => {
    setDetailDefaultTab("details")
    setSelectedBooking(booking)
    setDetailOpen(true)
  }

  const handleEditClick = (booking: Booking) => {
    setDetailDefaultTab("reschedule")
    setSelectedBooking(booking)
    setDetailOpen(true)
  }

  return (
    <ListPageShell>
      {/* Page identity zone — breadcrumb + header grouped tight */}
      <div className="flex flex-col gap-2">
        <Breadcrumbs />
        <PageHeader
          title={t("bookings.title")}
          description={t("bookings.description")}
        >
          <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("bookings.newBooking")}
          </Button>
        </PageHeader>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="bookings">{t("bookings.tabs.list")}</TabsTrigger>
          <TabsTrigger value="problemReports">{t("bookings.tabs.problemReports")}</TabsTrigger>
          {bookingSettings?.waitlistEnabled && (
            <TabsTrigger value="waitlist">{t("bookings.tabs.waitlist")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          <BookingsTabContent onRowClick={handleRowClick} onEditClick={handleEditClick} />
        </TabsContent>

        <TabsContent value="problemReports" className="mt-4">
          <ProblemReportsTab />
        </TabsContent>

        {bookingSettings?.waitlistEnabled && (
          <TabsContent value="waitlist" className="mt-4">
            <WaitlistTab />
          </TabsContent>
        )}
      </Tabs>

      <BookingCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />

      <BookingDetailSheet
        booking={selectedBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAction={() => { setDetailOpen(false); refresh() }}
        defaultTab={detailDefaultTab}
      />
    </ListPageShell>
  )
}
