/**
 * Widget API — CareKit Embeddable Booking Widget
 *
 * Public + patient-facing API calls for the booking widget.
 * Uses the same api client (proxy + token injection) as the dashboard.
 */

import { api, setAccessToken } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Practitioner, TimeSlot, PractitionerServiceType } from "@/lib/types/practitioner"
import type { Service, ServiceBookingType } from "@/lib/types/service"
import type { Booking, CreateBookingPayload } from "@/lib/types/booking"
import type { AuthUser } from "@/lib/api/auth"

/* ─── Whitelabel ─── */

export interface WidgetBranding {
  clinic_name: string
  clinic_name_en: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  secondary_color: string | null
  contact_phone: string | null
  contact_email: string | null
  app_name: string | null
  app_name_en: string | null
  payment_moyasar_enabled: string | null
  payment_at_clinic_enabled: string | null
}

export async function fetchWidgetBranding(): Promise<WidgetBranding> {
  return api.get<WidgetBranding>("/whitelabel/public")
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
  giftCardId?: string
}

export async function validateWidgetCode(
  payload: ValidateCodePayload,
): Promise<ValidateCodeResult> {
  const res = await api.post<{ data: ValidateCodeResult }>("/coupons/validate", payload)
  return res.data
}

/* ─── Practitioners ─── */

export interface WidgetPractitionersQuery {
  search?: string
  specialty?: string
  page?: number
  perPage?: number
  serviceId?: string
}

export async function fetchWidgetPractitioners(
  query: WidgetPractitionersQuery = {},
): Promise<PaginatedResponse<Practitioner>> {
  const res = await api.get<PaginatedResponse<RawPractitioner>>("/practitioners", {
    page: query.page,
    perPage: query.perPage ?? 20,
    search: query.search,
    specialty: query.specialty,
    serviceId: query.serviceId,
  })
  return { items: res.items.map(mapPractitioner), meta: res.meta }
}

export async function fetchWidgetPractitioner(id: string): Promise<Practitioner> {
  const res = await api.get<RawPractitioner>(`/practitioners/${id}`)
  return mapPractitioner(res)
}

export async function fetchWidgetPractitionerServices(
  practitionerId: string,
): Promise<Service[]> {
  return api.get<Service[]>(`/practitioners/${practitionerId}/services`)
}

export async function fetchWidgetServiceTypes(
  practitionerId: string,
  serviceId: string,
): Promise<PractitionerServiceType[]> {
  return api.get<PractitionerServiceType[]>(
    `/practitioners/${practitionerId}/services/${serviceId}/types`,
  )
}

export async function fetchWidgetSlots(
  practitionerId: string,
  date: string,
  duration?: number,
): Promise<TimeSlot[]> {
  const res = await api.get<TimeSlot[] | { slots: TimeSlot[] }>(
    `/practitioners/${practitionerId}/slots`,
    { date, duration },
  )
  return Array.isArray(res) ? res : (res.slots ?? [])
}

export async function fetchWidgetAvailableDates(
  practitionerId: string,
  month: string,
  duration?: number,
  branchId?: string,
): Promise<string[]> {
  const res = await api.get<{ availableDates: string[] }>(
    `/practitioners/${practitionerId}/available-dates`,
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

/* ─── Auth (patient-facing) ─── */

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

type RawPractitioner = Omit<Practitioner, "averageRating" | "_count"> & {
  rating?: number
  reviewCount?: number
  _count?: Practitioner["_count"]
  averageRating?: number
}

function mapPractitioner(raw: RawPractitioner): Practitioner {
  return {
    ...raw,
    averageRating: raw.averageRating ?? raw.rating ?? undefined,
    _count: raw._count ?? { bookings: 0, ratings: raw.reviewCount ?? 0 },
  }
}
