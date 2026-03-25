/**
 * L3: Centralized bilingual notification message templates.
 * Static titles and bodies are defined here to prevent drift between
 * Arabic and English when messages are updated.
 *
 * Dynamic bodies (containing dates/names) are built inline at the call site
 * using these titles as anchors.
 */

export const NOTIF = {
  BOOKING_CONFIRMED: {
    titleAr: 'تأكيد الموعد',
    titleEn: 'Booking Confirmed',
  },
  BOOKING_NEW_FOR_PRACTITIONER: {
    titleAr: 'حجز جديد',
    titleEn: 'New Booking',
  },
  BOOKING_RESCHEDULED: {
    titleAr: 'إعادة جدولة الموعد',
    titleEn: 'Booking Rescheduled',
  },
  BOOKING_RESCHEDULED_PRACTITIONER: {
    titleAr: 'إعادة جدولة موعد',
    titleEn: 'Booking Rescheduled',
    bodyAr: 'تم إعادة جدولة أحد مواعيدك',
    bodyEn: 'One of your bookings has been rescheduled',
  },
  BOOKING_CANCELLED: {
    titleAr: 'تم إلغاء الموعد',
    titleEn: 'Booking Cancelled',
  },
  BOOKING_CANCELLED_BY_PRACTITIONER: {
    titleAr: 'تم إلغاء موعدك من قبل الطبيب',
    titleEn: 'Your Booking Was Cancelled by Practitioner',
  },
  BOOKING_COMPLETED: {
    titleAr: 'اكتمل الموعد',
    titleEn: 'Booking Completed',
    bodyAr: 'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
    bodyEn: 'Your booking is completed. You can now rate your experience',
  },
  CANCELLATION_REJECTED: {
    titleAr: 'تم رفض طلب الإلغاء',
    titleEn: 'Cancellation Rejected',
    bodyAr: 'تم رفض طلب إلغاء موعدك. الموعد لا يزال مؤكداً',
    bodyEn: 'Your cancellation request was rejected. The booking remains confirmed',
  },
  PATIENT_ARRIVED: {
    titleAr: 'وصول المريض',
    titleEn: 'Patient Arrived',
    bodyAr: 'المريض وصل وجاهز للموعد',
    bodyEn: 'Patient has arrived and is ready',
  },
  RECEIPT_REJECTED: {
    titleAr: 'تم رفض إيصال التحويل البنكي',
    titleEn: 'Bank Transfer Receipt Rejected',
  },
  WAITLIST_SLOT_AVAILABLE: {
    titleAr: 'موعد متاح!',
    titleEn: 'Slot Available!',
  },
  CANCELLATION_REQUEST_NEW: {
    titleAr: 'طلب إلغاء موعد جديد',
    titleEn: 'New Cancellation Request',
  },
  PRACTITIONER_CANCELLED_BOOKING: {
    titleAr: 'إلغاء موعد من طبيب',
    titleEn: 'Practitioner Cancelled Booking',
  },
} as const;
