/**
 * Report Types — CareKit Dashboard
 */

/* ─── Query ─── */

export interface ReportDateQuery {
  dateFrom: string
  dateTo: string
}

export interface RevenueReportQuery extends ReportDateQuery {
  practitionerId?: string
}

/* ─── Response ─── */

export interface RevenueReport {
  totalRevenue: number
  totalBookings: number
  averagePerBooking: number
  byMethod: { method: string; amount: number; count: number }[]
  byDay: { date: string; amount: number; count: number }[]
}

export interface BookingReport {
  total: number
  byStatus: { status: string; count: number }[]
  byType: { type: string; count: number }[]
  byDay: { date: string; count: number }[]
}

export interface PractitionerReport {
  practitionerId: string
  totalBookings: number
  completedBookings: number
  totalRevenue: number
  averageRating: number
  byDay: { date: string; bookings: number; revenue: number }[]
}
