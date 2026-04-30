/**
 * Booking Settings API — Deqah Dashboard
 */

import { api } from "@/lib/api"

export type RecurringPattern =
  | "daily"
  | "every_2_days"
  | "every_3_days"
  | "weekly"
  | "biweekly"
  | "monthly"

export const RECURRING_PATTERNS: { value: RecurringPattern; labelKey: string }[] = [
  { value: "daily", labelKey: "settings.recurringPattern.daily" },
  { value: "every_2_days", labelKey: "settings.recurringPattern.every_2_days" },
  { value: "every_3_days", labelKey: "settings.recurringPattern.every_3_days" },
  { value: "weekly", labelKey: "settings.recurringPattern.weekly" },
  { value: "biweekly", labelKey: "settings.recurringPattern.biweekly" },
  { value: "monthly", labelKey: "settings.recurringPattern.monthly" },
]

export interface BookingSettings {
  id: string
  paymentTimeoutMinutes: number
  freeCancelBeforeHours: number
  freeCancelRefundType: string
  lateCancelRefundType: string
  lateCancelRefundPercent: number
  adminCanDirectCancel: boolean
  clientCanCancelPending: boolean
  clientCanReschedule: boolean
  rescheduleBeforeHours: number
  maxReschedulesPerBooking: number
  allowWalkIn: boolean
  walkInPaymentRequired: boolean
  allowRecurring: boolean
  maxRecurrences: number
  allowedRecurringPatterns: string[]
  waitlistEnabled: boolean
  waitlistMaxPerSlot: number
  waitlistAutoNotify: boolean
  bufferMinutes: number
  autoCompleteAfterHours: number
  autoNoShowAfterMinutes: number
  noShowPolicy: string
  noShowRefundPercent: number
  cancellationReviewTimeoutHours: number
  cancellationPolicyEn: string
  cancellationPolicyAr: string
  reminder24hEnabled: boolean
  reminder1hEnabled: boolean
  reminderInteractive: boolean
  suggestAlternativesOnConflict: boolean
  suggestAlternativesCount: number
  minBookingLeadMinutes: number
  maxAdvanceBookingDays: number
  adminCanBookOutsideHours: boolean
  // Widget settings
  widgetShowPrice: boolean
  widgetAnyEmployee: boolean
  widgetRedirectUrl: string | null
  createdAt: string
  updatedAt: string
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  return api.get<BookingSettings>("/dashboard/organization/booking-settings")
}

export async function updateBookingSettings(
  data: Record<string, unknown>,
): Promise<BookingSettings> {
  return api.patch<BookingSettings>(
    "/dashboard/organization/booking-settings",
    data,
  )
}
