/**
 * Reports API — CareKit Dashboard
 */

import { api, getAccessToken } from "@/lib/api"
import type {
  RevenueReport,
  BookingReport,
  EmployeeReport,
  RevenueReportQuery,
  ReportDateQuery,
} from "@/lib/types/report"

/* ─── Queries ─── */

export async function fetchRevenueReport(
  query: RevenueReportQuery,
): Promise<RevenueReport> {
  return api.get<RevenueReport>("/reports/revenue", {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    employeeId: query.employeeId,
  })
}

export async function fetchBookingReport(
  query: ReportDateQuery,
): Promise<BookingReport> {
  return api.get<BookingReport>("/reports/bookings", {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}

export async function fetchEmployeeReport(
  id: string,
  query: ReportDateQuery,
): Promise<EmployeeReport> {
  return api.get<EmployeeReport>(
    `/reports/employees/${id}`,
    { dateFrom: query.dateFrom, dateTo: query.dateTo },
  )
}

/* ─── CSV Exports ─── */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

function downloadCsv(url: string, filename: string) {
  const token = getAccessToken()

  const a = document.createElement("a")
  fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  })
    .then((res) => res.blob())
    .then((blob) => {
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

export function exportRevenueCsv(dateFrom: string, dateTo: string) {
  downloadCsv(
    `/reports/revenue/export?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    `revenue-${dateFrom}-to-${dateTo}.csv`,
  )
}

export function exportBookingsCsv(dateFrom: string, dateTo: string) {
  downloadCsv(
    `/reports/bookings/export?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    `bookings-${dateFrom}-to-${dateTo}.csv`,
  )
}

export function exportClientsCsv() {
  downloadCsv("/reports/clients/export?format=csv", "clients.csv")
}

export function exportClientsExcel() {
  downloadCsv("/reports/clients/export?format=xlsx", "clients.xlsx")
}

export function exportEmployeesCsv() {
  downloadCsv("/reports/employees/export?format=csv", "employees.csv")
}

export function exportEmployeesExcel() {
  downloadCsv("/reports/employees/export?format=xlsx", "employees.xlsx")
}
