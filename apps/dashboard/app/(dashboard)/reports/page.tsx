"use client"

import { useState } from "react"
import { subDays, format } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import { FilterBar } from "@/components/features/filter-bar"
import { PractitionerCombobox } from "@/components/features/reports/practitioner-combobox"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { RevenueTab } from "@/components/features/reports/revenue-tab"
import { BookingsTab } from "@/components/features/reports/bookings-tab"
import { PractitionersTab } from "@/components/features/reports/practitioners-tab"
import { exportRevenueCsv, exportBookingsCsv } from "@/lib/api/reports"

const today = format(new Date(), "yyyy-MM-dd")
const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd")

export default function ReportsPage() {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState("revenue")
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [selectedPractitionerId, setSelectedPractitionerId] = useState("")

  const handleExport = () => {
    if (!dateFrom || !dateTo) return
    if (activeTab === "revenue") exportRevenueCsv(dateFrom, dateTo)
    if (activeTab === "bookings") exportBookingsCsv(dateFrom, dateTo)
  }

  const showExport = activeTab === "revenue" || activeTab === "bookings"

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      >
        {showExport && (
          <Button
            className="gap-2 rounded-full px-5"
            disabled={!dateFrom || !dateTo}
            onClick={handleExport}
          >
            <HugeiconsIcon icon={Download04Icon} size={16} />
            {t("reports.exportCsv")}
          </Button>
        )}
      </PageHeader>

      {/* Date Filter — shared across all tabs */}
      <FilterBar
        dateRange={{
          dateFrom,
          dateTo,
          onDateFromChange: setDateFrom,
          onDateToChange: setDateTo,
          placeholderFrom: t("reports.dateFrom"),
          placeholderTo: t("reports.dateTo"),
        }}
        hasFilters={dateFrom !== thirtyDaysAgo || dateTo !== today}
        onReset={() => { setDateFrom(thirtyDaysAgo); setDateTo(today) }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="revenue">{t("reports.tabs.revenue")}</TabsTrigger>
            <TabsTrigger value="bookings">{t("reports.tabs.bookings")}</TabsTrigger>
            <TabsTrigger value="practitioners">{t("reports.tabs.practitioners")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="revenue">
          <RevenueTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>

        <TabsContent value="practitioners">
          <div className="flex flex-col gap-4 pt-2">
            <PractitionerCombobox
              value={selectedPractitionerId}
              onChange={setSelectedPractitionerId}
            />
            <PractitionersTab
              dateFrom={dateFrom}
              dateTo={dateTo}
              practitionerId={selectedPractitionerId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
