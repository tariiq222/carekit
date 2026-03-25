/** Shared constants and helpers for payment services */
import { VAT_RATE_DEFAULT } from '../../config/constants/index.js';

/** M10: Single VAT calculation — avoids hardcoded 0.15 duplicated across files */
export function applyVat(amount: number): { amount: number; vatAmount: number; totalAmount: number } {
  const vatAmount = Math.round(amount * VAT_RATE_DEFAULT / 100);
  return { amount, vatAmount, totalAmount: amount + vatAmount };
}

export const paymentInclude = {
  booking: {
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      practitioner: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  },
  receipt: true,
  invoice: true,
};

export const bookingWithPriceInclude = {
  practitioner: true,
  service: true,
  practitionerService: true,
};

/**
 * 3-tier price resolution:
 * 1. PractitionerService (per service × practitioner) — null = skip
 * 2. Practitioner (legacy flat pricing) — null/0 = skip
 * 3. Service catalog default
 */
export function calculateAmounts(booking: {
  type: string;
  practitionerService?: {
    priceClinic: number | null;
    pricePhone: number | null;
    priceVideo: number | null;
  } | null;
  practitioner: {
    priceClinic: number;
    pricePhone: number;
    priceVideo: number;
  } | null;
  service: { price: number } | null;
}): { amount: number; vatAmount: number; totalAmount: number } {
  const priceByType = resolvePriceByType(booking);
  const amount = priceByType ?? booking.service?.price ?? 0;
  return applyVat(amount);
}

function resolvePriceByType(booking: {
  type: string;
  practitionerService?: {
    priceClinic: number | null;
    pricePhone: number | null;
    priceVideo: number | null;
  } | null;
  practitioner: {
    priceClinic: number;
    pricePhone: number;
    priceVideo: number;
  } | null;
}): number | null {
  const ps = booking.practitionerService;
  const pr = booking.practitioner;

  if (booking.type === 'clinic_visit') {
    return ps?.priceClinic ?? pr?.priceClinic ?? null;
  }
  if (booking.type === 'phone_consultation') {
    return ps?.pricePhone ?? pr?.pricePhone ?? null;
  }
  if (booking.type === 'video_consultation') {
    return ps?.priceVideo ?? pr?.priceVideo ?? null;
  }
  return null;
}
