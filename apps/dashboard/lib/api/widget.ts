/**
 * Widget API — CareKit Embeddable Booking Widget
 *
 * Public + client-facing API calls for the booking widget.
 * Uses the same api client (proxy + token injection) as the dashboard.
 */

import { api, setAccessToken } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Employee, TimeSlot, EmployeeServiceType } from "@/lib/types/employee"
import type { Service, ServiceBookingType } from "@/lib/types/service"
import type { Booking, CreateBookingPayload } from "@/lib/types/booking"
import type { AuthUser } from "@/lib/api/auth"

/* ─── Whitelabel / Branding ─── */

/* ─── Bank account shape (mirrors BankAccount in bank-account-card.tsx) ─── */
export interface WidgetBankAccount {
  id: string
  bankId: string
  iban: string
  holderName: string
}

export interface WidgetBranding {
  // System identity
  system_name: string
  system_name_ar: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  secondary_color: string | null
  contact_phone: string | null
  contact_email: string | null
  // Payment flags (string "true"/"false" for backward compat)
  payment_moyasar_enabled: string | null
  payment_at_clinic_enabled: string | null
  // Bank transfer
  bank_transfer_enabled: boolean
  bank_accounts: WidgetBankAccount[]
  // Widget behaviour settings
  widget_show_price: boolean
  widget_any_employee: boolean
  widget_redirect_url: string | null
  widget_max_advance_days: number
}

function parseBankAccounts(raw: unknown): WidgetBankAccount[] {
  if (typeof raw !== "string" || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as WidgetBankAccount[]
  } catch { /* ignore */ }
  return []
}

export async function fetchWidgetBranding(): Promise<WidgetBranding> {
  const raw = await api.get<Record<string, unknown>>("/whitelabel/public")
  return {
    system_name:               String(raw.system_name ?? ""),
    system_name_ar:            String(raw.system_name_ar ?? ""),
    logo_url:                  raw.logo_url ? String(raw.logo_url) : null,
    favicon_url:               raw.favicon_url ? String(raw.favicon_url) : null,
    primary_color:             raw.primary_color ? String(raw.primary_color) : null,
    secondary_color:           raw.secondary_color ? String(raw.secondary_color) : null,
    contact_phone:             raw.contact_phone ? String(raw.contact_phone) : null,
    contact_email:             raw.contact_email ? String(raw.contact_email) : null,
    payment_moyasar_enabled:   raw.payment_moyasar_enabled ? String(raw.payment_moyasar_enabled) : null,
    payment_at_clinic_enabled: raw.payment_at_clinic_enabled ? String(raw.payment_at_clinic_enabled) : null,
    bank_transfer_enabled:     raw.bank_transfer_enabled === "true" || raw.bank_transfer_enabled === true,
    bank_accounts:             parseBankAccounts(raw.bank_accounts),
    widget_show_price:          raw.widget_show_price !== false,
    widget_any_employee:    raw.widget_any_employee === true,
    widget_redirect_url:        raw.widget_redirect_url ? String(raw.widget_redirect_url) : null,
    widget_max_advance_days:    typeof raw.widget_max_advance_days === "number"
      ? raw.widget_max_advance_days
      : Number(raw.widget_max_advance_days ?? 0),
  }
}

/* ─── Branches ─── */

export interface PublicBranch {
  id: string
  nameAr: string
  nameEn: string
  address: string | null
  phone: string | null
}

export async function fetchPublicBranches(): Promise<PublicBranch[]> {
  return api.get<PublicBranch[]>("/branches/public")
}

/* ─── Coupon / Gift Card Validation ─── */

export interface ValidateCodePayload {
  code: string
  serviceId: string
  amount: number
}

export interface ValidateCodeResult {
  valid: boolean
  discountAmount: number
  type: "coupon" | "gift_card"
  couponId?: string
}

export async function validateWidgetCode(
  payload: ValidateCodePayload,
): Promise<ValidateCodeResult> {
  const res = await api.post<{ data: ValidateCodeResult }>("/coupons/validate", payload)
  return res.data
}

/* ─── Employees ─── */

export interface WidgetEmployeesQuery {
  search?: string
  specialty?: string
  page?: number
  perPage?: number
  serviceId?: string
}

export async function fetchWidgetEmployees(
  query: WidgetEmployeesQuery = {},
): Promise<PaginatedResponse<Employee>> {
  const res = await api.get<PaginatedResponse<RawEmployee>>("/employees", {
    page: query.page,
    perPage: query.perPage ?? 20,
    search: query.search,
    specialty: query.specialty,
    serviceId: query.serviceId,
  })
  return { items: res.items.map(mapEmployee), meta: res.meta }
}

export async function fetchWidgetEmployee(id: string): Promise<Employee> {
  const res = await api.get<RawEmployee>(`/employees/${id}`)
  return mapEmployee(res)
}

export async function fetchWidgetEmployeeServices(
  employeeId: string,
): Promise<Service[]> {
  return api.get<Service[]>(`/employees/${employeeId}/services`)
}

export async function fetchWidgetServiceTypes(
  employeeId: string,
  serviceId: string,
): Promise<EmployeeServiceType[]> {
  return api.get<EmployeeServiceType[]>(
    `/employees/${employeeId}/services/${serviceId}/types`,
  )
}

export async function fetchWidgetSlots(
  employeeId: string,
  date: string,
  duration?: number,
): Promise<TimeSlot[]> {
  const res = await api.get<TimeSlot[] | { slots: TimeSlot[] }>(
    `/employees/${employeeId}/slots`,
    { date, duration },
  )
  return Array.isArray(res) ? res : (res.slots ?? [])
}

export async function fetchWidgetAvailableDates(
  employeeId: string,
  month: string,
  duration?: number,
  branchId?: string,
): Promise<string[]> {
  const res = await api.get<{ availableDates: string[] }>(
    `/employees/${employeeId}/available-dates`,
    { month, duration, branchId },
  )
  return res.availableDates
}

/* ─── Services ─── */

export async function fetchWidgetServices(): Promise<PaginatedResponse<Service>> {
  return api.get<PaginatedResponse<Service>>("/services", { isActive: true, perPage: 50 })
}

export async function fetchWidgetServiceBookingTypes(
  serviceId: string,
): Promise<ServiceBookingType[]> {
  return api.get<ServiceBookingType[]>(`/services/${serviceId}/booking-types`)
}

/* ─── Auth (client-facing) ─── */

interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

interface AuthResponse {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

interface OtpSendResponse {
  message: string
}

export async function widgetRegister(payload: RegisterPayload): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/register", payload)
  setAccessToken(data.accessToken)
  return data
}

export async function widgetSendOtp(email: string, password: string): Promise<OtpSendResponse> {
  return api.post<OtpSendResponse>("/auth/login/otp/send", { email, password })
}

export async function widgetVerifyOtp(
  email: string,
  code: string,
): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login/otp/verify", { email, code })
  setAccessToken(data.accessToken)
  return data
}

export async function widgetLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", { email, password })
  setAccessToken(data.accessToken)
  return data
}

/* ─── Booking ─── */

export async function widgetCreateBooking(
  payload: CreateBookingPayload,
): Promise<Booking> {
  return api.post<Booking>("/bookings", payload)
}

/* ─── Internal ─── */

type RawEmployee = Omit<Employee, "averageRating" | "_count"> & {
  rating?: number
  reviewCount?: number
  _count?: Employee["_count"]
  averageRating?: number
}

function mapEmployee(raw: RawEmployee): Employee {
  return {
    ...raw,
    averageRating: raw.averageRating ?? raw.rating ?? undefined,
    _count: raw._count ?? { bookings: 0, ratings: raw.reviewCount ?? 0 },
  }
}
