"use client"

import { useConfigMap } from "@/hooks/use-whitelabel"
import { formatClinicDate, formatClinicTime, getWeekStartDay } from "@/lib/utils"
import type { DateFormat, TimeFormat } from "@/lib/utils"

/**
 * Hook that provides clinic configuration values and formatting helpers.
 * Reads from WhiteLabelConfig via the existing useConfigMap hook.
 *
 * Usage:
 *   const { dateFormat, timeFormat, formatDate, formatTime } = useClinicConfig()
 *   formatDate(booking.date)   // → "24/03/2026" (if d/m/Y configured)
 *   formatTime("14:30")        // → "2:30 م" (if 12h configured)
 */
export function useClinicConfig() {
  const { data: configMap } = useConfigMap()

  const dateFormat = (configMap?.date_format ?? "Y-m-d") as DateFormat
  const timeFormat = (configMap?.time_format ?? "24h") as TimeFormat
  const weekStartDay = (configMap?.week_start_day ?? "sunday") as "sunday" | "monday"
  const timezone = configMap?.timezone ?? "Asia/Riyadh"

  return {
    dateFormat,
    timeFormat,
    weekStartDay,
    timezone,
    weekStartDayNumber: getWeekStartDay(weekStartDay),
    formatDate: (date: Date | string) => formatClinicDate(date, dateFormat),
    formatTime: (time: string) => formatClinicTime(time, timeFormat),
  }
}
