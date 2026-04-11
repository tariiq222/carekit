/** Shared constants and helpers for payment services */
import { VAT_RATE_DEFAULT } from '../../config/constants/index.js';

/** M10: Single VAT calculation — avoids hardcoded 0.15 duplicated across files */
export function applyVat(amount: number): {
  amount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const vatAmount = Math.round((amount * VAT_RATE_DEFAULT) / 100);
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
 * Price is resolved at booking creation via PriceResolverService and stored
 * as bookedPrice (immutable snapshot). Use booking.bookedPrice directly.
 */
export function calculateAmounts(booking: {
  bookedPrice: number | null;
  service: { price: number } | null;
}): { amount: number; vatAmount: number; totalAmount: number } {
  const amount = booking.bookedPrice ?? booking.service?.price ?? 0;
  return applyVat(amount);
}
