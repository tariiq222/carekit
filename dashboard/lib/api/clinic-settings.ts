/**
 * Clinic Settings API — CareKit Dashboard
 *
 * Endpoints for fetching and updating clinic-level configuration,
 * including the booking flow order setting.
 */

import { api } from "@/lib/api"

export type BookingFlowOrder = "service_first" | "practitioner_first"

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  return api.get<BookingFlowOrder>("/clinic/settings/booking-flow")
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  return api.patch<BookingFlowOrder>("/clinic/settings/booking-flow", {
    order,
  })
}

/* ─── Payment Settings ─── */

export interface PaymentSettings {
  paymentMoyasarEnabled: boolean
  paymentAtClinicEnabled: boolean
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const res = await api.get<{ data: PaymentSettings }>("/clinic/settings/payment")
  return res.data
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  const res = await api.patch<{ data: PaymentSettings }>("/clinic/settings/payment", settings)
  return res.data
}
