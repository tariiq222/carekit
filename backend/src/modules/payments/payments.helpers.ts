/** Shared constants and helpers for payment services */

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
          specialty: { select: { nameEn: true, nameAr: true } },
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
};

export function calculateAmounts(booking: {
  type: string;
  practitioner: { priceClinic: number; pricePhone: number; priceVideo: number } | null;
  service: { price: number } | null;
}): { amount: number; vatAmount: number; totalAmount: number } {
  let amount = 0;

  if (booking.practitioner) {
    if (booking.type === 'clinic_visit') {
      amount = booking.practitioner.priceClinic;
    } else if (booking.type === 'phone_consultation') {
      amount = booking.practitioner.pricePhone;
    } else if (booking.type === 'video_consultation') {
      amount = booking.practitioner.priceVideo;
    }
  }

  if (amount === 0 && booking.service) {
    amount = booking.service.price;
  }

  const vatAmount = Math.round(amount * 0.15);
  const totalAmount = amount + vatAmount;

  return { amount, vatAmount, totalAmount };
}
