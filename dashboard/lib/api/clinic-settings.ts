/**
 * Clinic Settings API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  ClinicSettings,
  UpdateClinicSettingsPayload,
  PublicClinicSettings,
} from "@/lib/types/clinic-settings"

/* ─── Queries ─── */

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  return api.get<ClinicSettings>("/clinic-settings")
}

export async function fetchClinicSettingsPublic(): Promise<PublicClinicSettings> {
  return api.get<PublicClinicSettings>("/clinic-settings/public")
}

/* ─── Mutations ─── */

export async function updateClinicSettings(
  data: UpdateClinicSettingsPayload,
): Promise<ClinicSettings> {
  return api.put<ClinicSettings>("/clinic-settings", data)
}

/* ─── Booking Flow Order (legacy clinic/ endpoints) ─── */

export type BookingFlowOrder = "service_first" | "practitioner_first" | "both"

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  const res = await api.get<{ bookingFlowOrder: BookingFlowOrder }>("/clinic/settings/booking-flow")
  return res.bookingFlowOrder ?? "service_first"
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  const res = await api.patch<{ bookingFlowOrder: BookingFlowOrder }>("/clinic/settings/booking-flow", {
    order,
  })
  return res.bookingFlowOrder ?? "service_first"
}

/* ─── Payment Settings (legacy clinic/ endpoints) ─── */

export interface PaymentSettings {
  paymentMoyasarEnabled: boolean
  paymentAtClinicEnabled: boolean
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  return api.get<PaymentSettings>("/clinic/settings/payment")
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  return api.patch<PaymentSettings>("/clinic/settings/payment", settings)
}
