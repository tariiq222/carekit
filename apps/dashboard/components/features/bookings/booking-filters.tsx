"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { BookingStatus, BookingType } from "@/lib/types/booking"

interface BookingFiltersProps {
  status: BookingStatus | "all"
  type: BookingType | "all"
  isGuest: boolean | "all"
  dateFrom: string
  dateTo: string
  onStatusChange: (value: BookingStatus | "all") => void
  onTypeChange: (value: BookingType | "all") => void
  onIsGuestChange: (value: boolean | "all") => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onReset: () => void
  hasFilters: boolean
}

const timeTabs = [
  { key: "all", labelKey: "bookings.filters.allTime" },
  { key: "today", labelKey: "bookings.filters.today" },
  { key: "week", labelKey: "bookings.filters.thisWeek" },
  { key: "month", labelKey: "bookings.filters.thisMonth" },
] as const

export function BookingFilters({
  status,
  type,
  isGuest,
  dateFrom,
  dateTo,
  onStatusChange,
  onTypeChange,
  onIsGuestChange,
  onDateFromChange,
  onDateToChange,
  onReset,
  hasFilters,
}: BookingFiltersProps) {
  const { t } = useLocale()

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab Pills — V1 style */}
        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
          {timeTabs.map((tab) => (
            <button
              key={tab.key}
              className={cn(
                "rounded-sm px-4 py-1.5 text-[13px] font-medium transition-all duration-200",
                !hasFilters && tab.key === "all"
                  ? "bg-primary text-primary-foreground shadow-primary"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/8"
              )}
            >
              {t(tab.labelKey) ?? tab.key}
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2">
          <Select
            value={type}
            onValueChange={(v) => onTypeChange(v as BookingType | "all")}
          >
            <SelectTrigger size="sm" className="w-auto min-w-[120px]">
              <SelectValue placeholder={t("bookings.filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("bookings.filters.allTypes")}</SelectItem>
              <SelectItem value="in_person">{t("bookings.filters.inPerson")}</SelectItem>
              <SelectItem value="online">{t("bookings.filters.online")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(isGuest)}
            onValueChange={(v) => onIsGuestChange(v === "all" ? "all" : v === "true")}
          >
            <SelectTrigger size="sm" className="w-auto min-w-[120px]">
              <SelectValue placeholder={t("bookings.filters.source")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("bookings.filters.allSources")}</SelectItem>
              <SelectItem value="true">{t("bookings.filters.guest")}</SelectItem>
              <SelectItem value="false">{t("bookings.filters.walkIn")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => onStatusChange(v as BookingStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-auto min-w-[120px]">
              <SelectValue placeholder={t("bookings.filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("bookings.filters.allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("bookings.filters.pending")}</SelectItem>
              <SelectItem value="confirmed">{t("bookings.filters.confirmed")}</SelectItem>
              <SelectItem value="completed">{t("bookings.filters.completed")}</SelectItem>
              <SelectItem value="cancelled">{t("bookings.filters.cancelled")}</SelectItem>
              <SelectItem value="pending_cancellation">
                {t("bookings.filters.cancelRequested")}
              </SelectItem>
              <SelectItem value="no_show">{t("bookings.filters.noShow")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden sm:block mx-1 h-6 w-px bg-border" />

          <DatePicker
            value={dateFrom}
            onChange={onDateFromChange}
            placeholder={t("bookings.filters.from")}
            className="w-auto"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <DatePicker
            value={dateTo}
            onChange={onDateToChange}
            placeholder={t("bookings.filters.to")}
            className="w-auto"
          />

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
              <span>{t("bookings.filters.reset")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
