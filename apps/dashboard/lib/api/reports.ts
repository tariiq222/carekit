/**
 * Reports API — CareKit Dashboard
 * Controller: dashboard/ops/reports
 */

import { api } from "@/lib/api"
import type { RevenueReport, BookingReport, EmployeeReport } from "@/lib/types/report"

export async function fetchRevenueReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<RevenueReport> {
  return api.post<RevenueReport>("/dashboard/ops/reports", {
    type: "revenue",
    ...params,
  })
}

export async function fetchBookingReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<BookingReport> {
  return api.post<BookingReport>("/dashboard/ops/reports", {
    type: "bookings",
    ...params,
  })
}

export async function fetchEmployeeReport(params: {
  dateFrom: string
  dateTo: string
  employeeId?: string
}): Promise<EmployeeReport> {
  return api.post<EmployeeReport>("/dashboard/ops/reports", {
    type: "employees",
    ...params,
  })
}
