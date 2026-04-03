/**
 * Clinic Settings API — CareKit Dashboard
 *
 * Endpoints for fetching and updating clinic-level configuration,
 * including the booking flow order setting.
 */

import { api } from "@/lib/api"

export type BookingFlowOrder = "service_first" | "practitioner_first" | "both"

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  // Backend returns { bookingFlowOrder: "..." } after api.ts unwraps the envelope
  const res = await api.get<{ bookingFlowOrder: BookingFlowOrder }>("/clinic/settings/booking-flow")
  return res.bookingFlowOrder ?? "service_first"
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  // Backend returns { bookingFlowOrder: "..." } after api.ts unwraps the envelope
  const res = await api.patch<{ bookingFlowOrder: BookingFlowOrder }>("/clinic/settings/booking-flow", {
    order,
  })
  return res.bookingFlowOrder ?? "service_first"
}

/* ─── Payment Settings ─── */

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
