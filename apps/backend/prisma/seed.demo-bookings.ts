import { PrismaClient, CancelledBy } from '@prisma/client';

// ═══════════════════════════════════════════════
// Bookings seed helpers — extracted for file-size compliance (≤350 lines)
// ═══════════════════════════════════════════════

// Fixed UUIDs for deterministic seed data
const BOOKING_IDS = {
  BK01: '11111111-0001-0000-0000-000000000001',
  BK02: '11111111-0002-0000-0000-000000000002',
  BK03: '11111111-0003-0000-0000-000000000003',
  BK04: '11111111-0004-0000-0000-000000000004',
  BK05: '11111111-0005-0000-0000-000000000005',
  BK06: '11111111-0006-0000-0000-000000000006',
  BK07: '11111111-0007-0000-0000-000000000007',
  BK08: '11111111-0008-0000-0000-000000000008',
  BK09: '11111111-0009-0000-0000-000000000009',
  BK10: '11111111-0010-0000-0000-000000000010',
  BK11: '11111111-0011-0000-0000-000000000011',
  BK12: '11111111-0012-0000-0000-000000000012',
  BK13: '11111111-0013-0000-0000-000000000013',
  BK14: '11111111-0014-0000-0000-000000000014',
  BK15: '11111111-0015-0000-0000-000000000015',
  BK16: '11111111-0016-0000-0000-000000000016',
  BK17: '11111111-0017-0000-0000-000000000017',
  BK18: '11111111-0018-0000-0000-000000000018',
};

const NOTIF_IDS = Array.from({ length: 12 }, (_, i) =>
  `22222222-${String(i).padStart(4, '0')}-0000-0000-${String(i).padStart(12, '0')}`,
);

export async function seedBookings(
  prisma: PrismaClient,
  patientIds: string[], practitionerIds: string[],
  serviceIds: string[], psIds: string[],
): Promise<void> {
  const today = new Date();
  const bookingDefs = buildBookingDefs(today, patientIds, practitionerIds, serviceIds, psIds);

  for (const b of bookingDefs) {
    const existing = await prisma.booking.findUnique({ where: { id: b.id as string } });
    if (existing) continue;

    const { _payMethod, _rating, _receiptStatus, ...bookingData } = b;

    const booking = await prisma.booking.create({ data: bookingData });

    await prisma.bookingStatusLog.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: bookingData.status, changedBy: 'system', reason: 'Seed data' },
    });

    if (['confirmed', 'completed', 'cancelled', 'pending_cancellation', 'no_show'].includes(bookingData.status)) {
      const payStatus = bookingData.status === 'completed' ? 'paid' : bookingData.status === 'cancelled' ? 'refunded' : 'paid';
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: bookingData.bookedPrice ?? 30000,
          vatAmount: Math.round((bookingData.bookedPrice ?? 30000) * 0.15),
          totalAmount: Math.round((bookingData.bookedPrice ?? 30000) * 1.15),
          method: _payMethod ?? 'moyasar',
          status: payStatus,
          moyasarPaymentId: _payMethod === 'moyasar' ? `moy_demo_${booking.id.replace(/-/g, '').slice(0, 16)}` : null,
        } as any,
      });

      await prisma.invoice.create({
        data: {
          paymentId: payment.id,
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vatAmount: payment.vatAmount,
          vatRate: 15,
        },
      });

      if (_payMethod === 'bank_transfer') {
        await prisma.bankTransferReceipt.create({
          data: {
            paymentId: payment.id,
            receiptUrl: '/uploads/receipts/demo-receipt.jpg',
            aiVerificationStatus: _receiptStatus ?? 'matched',
            aiConfidence: 0.95,
            aiNotes: 'Demo receipt — auto-verified',
            extractedAmount: bookingData.bookedPrice ?? 30000,
          },
        });
      }
    }

    if (bookingData.status === 'completed' && _rating) {
      await prisma.rating.create({
        data: {
          bookingId: booking.id,
          patientId: bookingData.patientId!,
          practitionerId: bookingData.practitionerId,
          stars: _rating.stars,
          comment: _rating.comment,
        },
      });
    }

  }

  console.log(`  Created ${bookingDefs.length} bookings with payments, invoices, ratings`);
}

function buildBookingDefs(
  today: Date,
  patientIds: string[], practitionerIds: string[],
  serviceIds: string[], psIds: string[],
) {
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt;
  };

  return [
    // ── Pending
    { id: BOOKING_IDS.BK01, patientId: patientIds[0], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'in_person' as const, date: d(1), startTime: '09:00', endTime: '09:30', status: 'pending' as const, bookedPrice: 30000, bookedDuration: 30 },
    { id: BOOKING_IDS.BK02, patientId: patientIds[1], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'online' as const, date: d(2), startTime: '10:00', endTime: '10:30', status: 'pending' as const, bookedPrice: 40000, bookedDuration: 30 },

    // ── Confirmed
    { id: BOOKING_IDS.BK03, patientId: patientIds[2], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'in_person' as const, date: d(0), startTime: '11:00', endTime: '11:30', status: 'confirmed' as const, bookedPrice: 30000, bookedDuration: 30, confirmedAt: d(0), _payMethod: 'moyasar' as const },
    { id: BOOKING_IDS.BK04, patientId: patientIds[3], practitionerId: practitionerIds[2], serviceId: serviceIds[2], practitionerServiceId: psIds[4], type: 'in_person' as const, date: d(0), startTime: '14:00', endTime: '14:45', status: 'confirmed' as const, bookedPrice: 25000, bookedDuration: 45, confirmedAt: d(0), _payMethod: 'bank_transfer' as const, _receiptStatus: 'matched' as const },

    // ── Completed (with ratings)
    { id: BOOKING_IDS.BK05, patientId: patientIds[4], practitionerId: practitionerIds[0], serviceId: serviceIds[1], practitionerServiceId: psIds[1], type: 'in_person' as const, date: d(-3), startTime: '09:00', endTime: '09:15', status: 'completed' as const, bookedPrice: 15000, bookedDuration: 15, completedAt: d(-3), _payMethod: 'moyasar' as const, _rating: { stars: 5, comment: 'ممتاز! دكتور محترف جداً' } },
    { id: BOOKING_IDS.BK06, patientId: patientIds[5], practitionerId: practitionerIds[1], serviceId: serviceIds[5], practitionerServiceId: psIds[3], type: 'in_person' as const, date: d(-5), startTime: '10:00', endTime: '10:45', status: 'completed' as const, bookedPrice: 80000, bookedDuration: 45, completedAt: d(-5), _payMethod: 'moyasar' as const, _rating: { stars: 4, comment: 'Very good laser session' } },
    { id: BOOKING_IDS.BK07, patientId: patientIds[6], practitionerId: practitionerIds[3], serviceId: serviceIds[6], practitionerServiceId: psIds[6], type: 'in_person' as const, date: d(-7), startTime: '11:00', endTime: '11:30', status: 'completed' as const, bookedPrice: 25000, bookedDuration: 30, completedAt: d(-7), _payMethod: 'bank_transfer' as const, _receiptStatus: 'approved' as const, _rating: { stars: 3, comment: 'جيد لكن وقت الانتظار طويل' } },

    // ── Completed (low rating)
    { id: BOOKING_IDS.BK08, patientId: patientIds[7], practitionerId: practitionerIds[2], serviceId: serviceIds[3], practitionerServiceId: psIds[5], type: 'in_person' as const, date: d(-2), startTime: '15:00', endTime: '16:00', status: 'completed' as const, bookedPrice: 40000, bookedDuration: 60, completedAt: d(-2), _payMethod: 'moyasar' as const, _rating: { stars: 2, comment: 'انتظرت طويلاً' } },

    // ── Cancelled
    { id: BOOKING_IDS.BK09, patientId: patientIds[8], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'online' as const, date: d(-1), startTime: '13:00', endTime: '13:30', status: 'cancelled' as const, bookedPrice: 15000, bookedDuration: 30, cancelledAt: d(-1), cancellationReason: 'ظرف طارئ', cancelledBy: CancelledBy.patient, _payMethod: 'moyasar' as const },

    // ── Pending Cancellation
    { id: BOOKING_IDS.BK10, patientId: patientIds[9], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'in_person' as const, date: d(3), startTime: '09:00', endTime: '09:30', status: 'pending_cancellation' as const, bookedPrice: 40000, bookedDuration: 30, cancellationReason: 'لا أستطيع الحضور', _payMethod: 'moyasar' as const },

    // ── No-Show
    { id: BOOKING_IDS.BK11, patientId: patientIds[0], practitionerId: practitionerIds[3], serviceId: serviceIds[7], practitionerServiceId: psIds[7], type: 'in_person' as const, date: d(-4), startTime: '16:00', endTime: '16:15', status: 'no_show' as const, bookedPrice: 10000, bookedDuration: 15, noShowAt: d(-4), _payMethod: 'moyasar' as const },

    // ── Expired
    { id: BOOKING_IDS.BK12, patientId: patientIds[1], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'in_person' as const, date: d(-10), startTime: '10:00', endTime: '10:30', status: 'expired' as const, bookedPrice: 30000, bookedDuration: 30 },

    // ── Checked-in (today)
    { id: BOOKING_IDS.BK13, patientId: patientIds[2], practitionerId: practitionerIds[2], serviceId: serviceIds[2], practitionerServiceId: psIds[4], type: 'in_person' as const, date: d(0), startTime: '09:30', endTime: '10:15', status: 'checked_in' as const, bookedPrice: 25000, bookedDuration: 45, checkedInAt: d(0), _payMethod: 'moyasar' as const },

    // ── In-Progress (today)
    { id: BOOKING_IDS.BK14, patientId: patientIds[3], practitionerId: practitionerIds[3], serviceId: serviceIds[6], practitionerServiceId: psIds[6], type: 'in_person' as const, date: d(0), startTime: '10:00', endTime: '10:30', status: 'in_progress' as const, bookedPrice: 25000, bookedDuration: 30, checkedInAt: d(0), inProgressAt: d(0), _payMethod: 'moyasar' as const },

    // ── Walk-in
    { id: BOOKING_IDS.BK15, patientId: patientIds[4], practitionerId: practitionerIds[0], serviceId: serviceIds[0], practitionerServiceId: psIds[0], type: 'walk_in' as const, date: d(0), startTime: '15:00', endTime: '15:30', status: 'confirmed' as const, bookedPrice: 30000, bookedDuration: 30, isWalkIn: true, confirmedAt: d(0), _payMethod: 'moyasar' as const },

    // ── Video consultation with Zoom
    { id: BOOKING_IDS.BK16, patientId: patientIds[5], practitionerId: practitionerIds[1], serviceId: serviceIds[4], practitionerServiceId: psIds[2], type: 'online' as const, date: d(4), startTime: '11:00', endTime: '11:30', status: 'confirmed' as const, bookedPrice: 40000, bookedDuration: 30, confirmedAt: d(0), zoomMeetingId: 'zoom-demo-123', zoomJoinUrl: 'https://zoom.us/j/demo123', zoomHostUrl: 'https://zoom.us/s/demo123', _payMethod: 'moyasar' as const },

    // ── Phone consultation
    { id: BOOKING_IDS.BK17, patientId: patientIds[6], practitionerId: practitionerIds[0], serviceId: serviceIds[1], practitionerServiceId: psIds[1], type: 'online' as const, date: d(5), startTime: '14:00', endTime: '14:15', status: 'pending' as const, bookedPrice: 15000, bookedDuration: 15 },

    // ── Bank transfer pending review
    { id: BOOKING_IDS.BK18, patientId: patientIds[7], practitionerId: practitionerIds[2], serviceId: serviceIds[3], practitionerServiceId: psIds[5], type: 'in_person' as const, date: d(6), startTime: '10:00', endTime: '11:00', status: 'confirmed' as const, bookedPrice: 40000, bookedDuration: 60, confirmedAt: d(0), _payMethod: 'bank_transfer' as const, _receiptStatus: 'pending' as const },
  ];
}

export async function seedNotifications(
  prisma: PrismaClient,
  patientIds: string[], practitionerUserIds: string[],
): Promise<void> {
  const notifs = [
    { userId: patientIds[0], titleAr: 'تم تأكيد حجزك', titleEn: 'Booking Confirmed', bodyAr: 'تم تأكيد حجزك يوم الأحد الساعة 9:00', bodyEn: 'Your booking on Sunday at 9:00 AM is confirmed', type: 'booking_confirmed' as const, isRead: true },
    { userId: patientIds[1], titleAr: 'تذكير بموعدك', titleEn: 'Appointment Reminder', bodyAr: 'لديك موعد غداً الساعة 10:00', bodyEn: 'You have an appointment tomorrow at 10:00 AM', type: 'booking_reminder' as const, isRead: false },
    { userId: patientIds[2], titleAr: 'تم إلغاء الحجز', titleEn: 'Booking Cancelled', bodyAr: 'تم إلغاء حجزك وسيتم إرجاع المبلغ', bodyEn: 'Your booking is cancelled and refund is processing', type: 'booking_cancelled' as const, isRead: false },
    { userId: patientIds[3], titleAr: 'تم استلام الدفع', titleEn: 'Payment Received', bodyAr: 'تم استلام دفعتك بنجاح — 250 ر.س', bodyEn: 'Payment of 250 SAR received successfully', type: 'payment_received' as const, isRead: true },
    { userId: patientIds[4], titleAr: 'تقييم جديد', titleEn: 'New Rating', bodyAr: 'شكراً لتقييمك! رأيك يساعدنا', bodyEn: 'Thanks for your rating! Your feedback helps us', type: 'new_rating' as const, isRead: false },
    { userId: patientIds[0], titleAr: 'تنبيه النظام', titleEn: 'System Alert', bodyAr: 'تم تحديث سياسة الإلغاء', bodyEn: 'Cancellation policy has been updated', type: 'system_alert' as const, isRead: false },
    { userId: patientIds[8], titleAr: 'طلب إلغاء مرفوض', titleEn: 'Cancellation Rejected', bodyAr: 'تم رفض طلب إلغاء حجزك', bodyEn: 'Your cancellation request was rejected', type: 'cancellation_rejected' as const, isRead: false },
    { userId: patientIds[6], titleAr: 'تم إكمال الحجز', titleEn: 'Booking Completed', bodyAr: 'اكتمل موعدك بنجاح. يسعدنا تقييمك', bodyEn: 'Your appointment is completed. We would love your feedback', type: 'booking_completed' as const, isRead: false },
    { userId: patientIds[7], titleAr: 'تم رفض الإيصال', titleEn: 'Receipt Rejected', bodyAr: 'تم رفض إيصال التحويل. يرجى إعادة الرفع', bodyEn: 'Bank transfer receipt was rejected. Please re-upload', type: 'receipt_rejected' as const, isRead: false },
    { userId: practitionerUserIds[0], titleAr: 'مريض وصل', titleEn: 'Patient Arrived', bodyAr: 'المريض في الانتظار. الموعد الساعة 9:30', bodyEn: 'Patient is waiting. Appointment at 9:30', type: 'patient_arrived' as const, isRead: true },
    { userId: patientIds[9], titleAr: 'تذكير عاجل', titleEn: 'Urgent Reminder', bodyAr: 'موعدك بعد ساعة! لا تنسى', bodyEn: 'Your appointment is in 1 hour!', type: 'booking_reminder_urgent' as const, isRead: false },
  ];

  for (let i = 0; i < notifs.length; i++) {
    const n = notifs[i];
    await prisma.notification.upsert({
      where: { id: NOTIF_IDS[i] },
      update: {},
      create: { id: NOTIF_IDS[i], ...n },
    });
  }
}
