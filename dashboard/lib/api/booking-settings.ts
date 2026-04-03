/**
 * Booking Settings API — CareKit Dashboard
 */

import { api } from "@/lib/api"

export type RecurringPattern =
  | "daily"
  | "every_2_days"
  | "every_3_days"
  | "weekly"
  | "biweekly"
  | "monthly"

export const RECURRING_PATTERNS: { value: RecurringPattern; labelAr: string; labelEn: string }[] = [
  { value: "daily", labelAr: "يومياً", labelEn: "Daily" },
  { value: "every_2_days", labelAr: "كل يومين", labelEn: "Every 2 days" },
  { value: "every_3_days", labelAr: "كل 3 أيام", labelEn: "Every 3 days" },
  { value: "weekly", labelAr: "أسبوعياً", labelEn: "Weekly" },
  { value: "biweekly", labelAr: "كل أسبوعين", labelEn: "Biweekly" },
  { value: "monthly", labelAr: "شهرياً", labelEn: "Monthly" },
]

export interface BookingSettings {
  id: string
  paymentTimeoutMinutes: number
  freeCancelBeforeHours: number
  freeCancelRefundType: string
  lateCancelRefundType: string
  lateCancelRefundPercent: number
  adminCanDirectCancel: boolean
  patientCanCancelPending: boolean
  patientCanReschedule: boolean
  rescheduleBeforeHours: number
  maxReschedulesPerBooking: number
  allowWalkIn: boolean
  walkInPaymentRequired: boolean
  allowRecurring: boolean
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
  widgetAnyPractitioner: boolean
  widgetRedirectUrl: string | null
  createdAt: string
  updatedAt: string
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  return api.get<BookingSettings>("/booking-settings")
}

export async function updateBookingSettings(
  data: Record<string, unknown>,
): Promise<BookingSettings> {
  return api.patch<BookingSettings>(
    "/booking-settings",
    data,
  )
}
