/**
 * Clinic Settings API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  OrganizationSettings,
  UpdateOrganizationSettingsPayload,
  PublicOrganizationSettings,
} from "@/lib/types/organization-settings"

/* ─── Queries ─── */

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  return api.get<OrganizationSettings>("/organization-settings")
}

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function fetchOrganizationSettingsPublic(): Promise<PublicOrganizationSettings> {
  return api.get<PublicOrganizationSettings>("/organization-settings/public")
}

/* ─── Mutations ─── */

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function updateOrganizationSettings(
  data: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  return api.put<OrganizationSettings>("/organization-settings", data)
}

/* ─── Booking Flow Order (legacy organization/ endpoints) ─── */

export type BookingFlowOrder = "service_first" | "employee_first" | "both"

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  const res = await api.get<{ bookingFlowOrder: BookingFlowOrder }>("/organization/settings/booking-flow")
  return res.bookingFlowOrder ?? "service_first"
}

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  const res = await api.patch<{ bookingFlowOrder: BookingFlowOrder }>("/organization/settings/booking-flow", {
    order,
  })
  return res.bookingFlowOrder ?? "service_first"
}

/* ─── Payment Settings (legacy organization/ endpoints) ─── */

export interface PaymentSettings {
  paymentMoyasarEnabled: boolean
  paymentAtClinicEnabled: boolean
}

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  return api.get<PaymentSettings>("/organization/settings/payment")
}

// TODO: no backend endpoint in dashboard controllers — needs backend route
export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  return api.patch<PaymentSettings>("/organization/settings/payment", settings)
}
