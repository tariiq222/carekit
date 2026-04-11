import { MessagingEvent } from '../messaging-events.js';
import type { EventTemplate } from '../messaging-templates.js';

export const bookingTemplates: Partial<Record<MessagingEvent, EventTemplate<Record<string, string>>>> = {
  [MessagingEvent.BOOKING_CONFIRMED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'تأكيد الموعد',
      titleEn: 'Booking Confirmed',
      bodyAr: `تم تأكيد موعدك مع ${ctx['practitionerName']} بتاريخ ${ctx['date']} الساعة ${ctx['time']}`,
      bodyEn: `Your appointment with ${ctx['practitionerName']} on ${ctx['date']} at ${ctx['time']} is confirmed`,
      notificationType: 'booking_confirmed',
    }),
  },

  [MessagingEvent.BOOKING_CONFIRMED_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'حجز جديد',
      titleEn: 'New Booking',
      bodyAr: `لديك حجز جديد بتاريخ ${ctx['date']} الساعة ${ctx['time']}`,
      bodyEn: `You have a new booking on ${ctx['date']} at ${ctx['time']}`,
      notificationType: 'booking_confirmed',
    }),
  },

  [MessagingEvent.BOOKING_REMINDER]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'تذكير بموعدك',
      titleEn: 'Appointment Reminder',
      bodyAr: `تذكير: موعدك مع ${ctx['practitionerName']} غداً الساعة ${ctx['time']}`,
      bodyEn: `Reminder: Your appointment with ${ctx['practitionerName']} is tomorrow at ${ctx['time']}`,
      notificationType: 'booking_reminder',
    }),
  },

  [MessagingEvent.BOOKING_REMINDER_URGENT]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'موعدك قريب',
      titleEn: 'Appointment Soon',
      bodyAr: `موعدك مع ${ctx['practitionerName']} خلال ساعة الساعة ${ctx['time']}`,
      bodyEn: `Your appointment with ${ctx['practitionerName']} is in 1 hour at ${ctx['time']}`,
      notificationType: 'booking_reminder_urgent',
    }),
  },

  [MessagingEvent.BOOKING_CANCELLED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'تم إلغاء الموعد',
      titleEn: 'Booking Cancelled',
      bodyAr: `تم إلغاء موعدك مع ${ctx['practitionerName']} بتاريخ ${ctx['date']}`,
      bodyEn: `Your booking with ${ctx['practitionerName']} on ${ctx['date']} has been cancelled`,
      notificationType: 'booking_cancelled',
    }),
  },

  [MessagingEvent.BOOKING_CANCELLED_BY_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'تم إلغاء موعدك من قبل الطبيب',
      titleEn: 'Your Booking Was Cancelled by Practitioner',
      bodyAr: `أعتذر، تم إلغاء موعدك بتاريخ ${ctx['date']} من قبل ${ctx['practitionerName']}`,
      bodyEn: `Your booking on ${ctx['date']} was cancelled by ${ctx['practitionerName']}`,
      notificationType: 'booking_practitioner_cancelled',
    }),
  },

  [MessagingEvent.BOOKING_CANCELLATION_REQUESTED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'طلب إلغاء موعد جديد',
      titleEn: 'New Cancellation Request',
      bodyAr: `طلب إلغاء موعد بتاريخ ${ctx['date']} الساعة ${ctx['time']}`,
      bodyEn: `Cancellation request for booking on ${ctx['date']} at ${ctx['time']}`,
      notificationType: 'booking_cancellation_requested',
    }),
  },

  [MessagingEvent.BOOKING_CANCELLATION_REJECTED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (_ctx) => ({
      titleAr: 'تم رفض طلب الإلغاء',
      titleEn: 'Cancellation Rejected',
      bodyAr: 'تم رفض طلب إلغاء موعدك. الموعد لا يزال مؤكداً',
      bodyEn: 'Your cancellation request was rejected. The booking remains confirmed',
      notificationType: 'cancellation_rejected',
    }),
  },

  [MessagingEvent.BOOKING_RESCHEDULED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'إعادة جدولة الموعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: `تم إعادة جدولة موعدك مع ${ctx['practitionerName']} إلى ${ctx['date']} الساعة ${ctx['time']}`,
      bodyEn: `Your booking with ${ctx['practitionerName']} has been rescheduled to ${ctx['date']} at ${ctx['time']}`,
      notificationType: 'booking_rescheduled',
    }),
  },

  [MessagingEvent.BOOKING_RESCHEDULED_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx) => ({
      titleAr: 'إعادة جدولة موعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: 'تم إعادة جدولة أحد مواعيدك',
      bodyEn: 'One of your bookings has been rescheduled',
      notificationType: 'booking_rescheduled',
    }),
  },

  [MessagingEvent.BOOKING_COMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx) => ({
      titleAr: 'اكتمل الموعد',
      titleEn: 'Booking Completed',
      bodyAr: 'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
      bodyEn: 'Your booking is completed. You can now rate your experience',
      notificationType: 'booking_completed',
    }),
  },

  [MessagingEvent.BOOKING_EXPIRED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'انتهى وقت الحجز',
      titleEn: 'Booking Expired',
      bodyAr: `انتهى وقت تأكيد حجزك بتاريخ ${ctx['date']}`,
      bodyEn: `Your booking on ${ctx['date']} has expired due to non-payment`,
      notificationType: 'booking_expired',
    }),
  },

  [MessagingEvent.BOOKING_NOSHOW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تغيب عن الموعد',
      titleEn: 'No-Show Recorded',
      bodyAr: `تم تسجيل تغيب عن موعدك بتاريخ ${ctx['date']}`,
      bodyEn: `A no-show was recorded for your appointment on ${ctx['date']}`,
      notificationType: 'booking_no_show',
    }),
  },

  [MessagingEvent.BOOKING_NOSHOW_REVIEW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'مراجعة حالة التغيب',
      titleEn: 'No-Show Review',
      bodyAr: `يرجى مراجعة حالة التغيب للموعد بتاريخ ${ctx['date']}`,
      bodyEn: `Please review the no-show for the booking on ${ctx['date']}`,
      notificationType: 'no_show_review',
    }),
  },

  [MessagingEvent.BOOKING_AUTOCOMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'اكتمل الموعد تلقائياً',
      titleEn: 'Booking Auto-Completed',
      bodyAr: `تم إتمام موعدك بتاريخ ${ctx['date']} تلقائياً`,
      bodyEn: `Your booking on ${ctx['date']} was automatically completed`,
      notificationType: 'booking_completed',
    }),
  },

  [MessagingEvent.PATIENT_ARRIVED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx) => ({
      titleAr: 'وصول المريض',
      titleEn: 'Patient Arrived',
      bodyAr: 'المريض وصل وجاهز للموعد',
      bodyEn: 'Patient has arrived and is ready',
      notificationType: 'patient_arrived',
    }),
  },

  [MessagingEvent.WAITLIST_SLOT_AVAILABLE]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'موعد متاح!',
      titleEn: 'Slot Available!',
      bodyAr: `أصبح هناك موعد متاح مع ${ctx['practitionerName']} بتاريخ ${ctx['date']}`,
      bodyEn: `A slot is now available with ${ctx['practitionerName']} on ${ctx['date']}`,
      notificationType: 'waitlist_slot_available',
    }),
  },
};
