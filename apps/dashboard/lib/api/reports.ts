/**
 * Reports API — CareKit Dashboard
 */

import { api, getAccessToken } from "@/lib/api"
import type {
  RevenueReport,
  BookingReport,
  PractitionerReport,
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
    practitionerId: query.practitionerId,
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

export async function fetchPractitionerReport(
  id: string,
  query: ReportDateQuery,
): Promise<PractitionerReport> {
  return api.get<PractitionerReport>(
    `/reports/practitioners/${id}`,
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

export function exportPatientsCsv() {
  downloadCsv("/reports/patients/export?format=csv", "patients.csv")
}

export function exportPatientsExcel() {
  downloadCsv("/reports/patients/export?format=xlsx", "patients.xlsx")
}

export function exportPractitionersCsv() {
  downloadCsv("/reports/practitioners/export?format=csv", "practitioners.csv")
}

export function exportPractitionersExcel() {
  downloadCsv("/reports/practitioners/export?format=xlsx", "practitioners.xlsx")
}
