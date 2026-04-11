import type { NotificationType } from '@prisma/client';
import { MessagingEvent } from './messaging-events.js';

export interface RenderedMessage {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  notificationType: NotificationType;
}

export interface EventTemplate<TCtx = Record<string, string>> {
  category: 'booking' | 'payment' | 'auth' | 'group' | 'system';
  defaultChannels: ('push' | 'email' | 'sms')[];
  /** When true, ignore per-user preferences and send on all defaultChannels */
  overridePreferences?: boolean;
  render: (ctx: TCtx) => RenderedMessage;
}

type BookingCtx = { date: string; time: string; practitionerName: string; serviceName: string };
type OtpCtx = { code: string; firstName?: string; otpType?: string };
type WelcomeCtx = { firstName: string };
type PractitionerWelcomeCtx = { firstName: string; otpCode: string };
type AmountCtx = { amount: string };
type GenericCtx = Record<string, string>;

export const TEMPLATES: Record<MessagingEvent, EventTemplate<never>> = {
  // ─── Auth ─────────────────────────────────────────────────────
  [MessagingEvent.OTP_REQUESTED]: {
    category: 'auth',
    defaultChannels: ['email', 'sms'],
    overridePreferences: true,
    render: (ctx: OtpCtx) => ({
      titleAr: 'رمز التحقق',
      titleEn: 'Verification Code',
      bodyAr: `رمز التحقق الخاص بك هو: ${ctx.code}`,
      bodyEn: `Your verification code is: ${ctx.code}`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.WELCOME]: {
    category: 'auth',
    defaultChannels: ['push', 'email'],
    render: (ctx: WelcomeCtx) => ({
      titleAr: 'أهلاً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx.firstName}، يسعدنا انضمامك`,
      bodyEn: `Welcome ${ctx.firstName}, we're glad to have you`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.PRACTITIONER_WELCOME]: {
    category: 'auth',
    defaultChannels: ['email'],
    render: (ctx: PractitionerWelcomeCtx) => ({
      titleAr: 'مرحباً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx.firstName}، رمز كلمة المرور المؤقت: ${ctx.otpCode}`,
      bodyEn: `Welcome ${ctx.firstName}, your temporary password code: ${ctx.otpCode}`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  // ─── Bookings ──────────────────────────────────────────────────
  [MessagingEvent.BOOKING_CONFIRMED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد الموعد',
      titleEn: 'Booking Confirmed',
      bodyAr: `تم تأكيد موعدك مع ${ctx.practitionerName} بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Your appointment with ${ctx.practitionerName} on ${ctx.date} at ${ctx.time} is confirmed`,
      notificationType: 'booking_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CONFIRMED_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'حجز جديد',
      titleEn: 'New Booking',
      bodyAr: `لديك حجز جديد بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `You have a new booking on ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_REMINDER]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تذكير بموعدك',
      titleEn: 'Appointment Reminder',
      bodyAr: `تذكير: موعدك مع ${ctx.practitionerName} غداً الساعة ${ctx.time}`,
      bodyEn: `Reminder: Your appointment with ${ctx.practitionerName} is tomorrow at ${ctx.time}`,
      notificationType: 'booking_reminder',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_REMINDER_URGENT]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'موعدك قريب',
      titleEn: 'Appointment Soon',
      bodyAr: `موعدك مع ${ctx.practitionerName} خلال ساعة الساعة ${ctx.time}`,
      bodyEn: `Your appointment with ${ctx.practitionerName} is in 1 hour at ${ctx.time}`,
      notificationType: 'booking_reminder_urgent',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تم إلغاء الموعد',
      titleEn: 'Booking Cancelled',
      bodyAr: `تم إلغاء موعدك مع ${ctx.practitionerName} بتاريخ ${ctx.date}`,
      bodyEn: `Your booking with ${ctx.practitionerName} on ${ctx.date} has been cancelled`,
      notificationType: 'booking_cancelled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLED_BY_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تم إلغاء موعدك من قبل الطبيب',
      titleEn: 'Your Booking Was Cancelled by Practitioner',
      bodyAr: `أعتذر، تم إلغاء موعدك بتاريخ ${ctx.date} من قبل ${ctx.practitionerName}`,
      bodyEn: `Your booking on ${ctx.date} was cancelled by ${ctx.practitionerName}`,
      notificationType: 'booking_practitioner_cancelled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLATION_REQUESTED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'طلب إلغاء موعد جديد',
      titleEn: 'New Cancellation Request',
      bodyAr: `طلب إلغاء موعد بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Cancellation request for booking on ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_cancellation_requested',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLATION_REJECTED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم رفض طلب الإلغاء',
      titleEn: 'Cancellation Rejected',
      bodyAr: 'تم رفض طلب إلغاء موعدك. الموعد لا يزال مؤكداً',
      bodyEn: 'Your cancellation request was rejected. The booking remains confirmed',
      notificationType: 'cancellation_rejected',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_RESCHEDULED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'إعادة جدولة الموعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: `تم إعادة جدولة موعدك مع ${ctx.practitionerName} إلى ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Your booking with ${ctx.practitionerName} has been rescheduled to ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_rescheduled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_RESCHEDULED_PRACTITIONER]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'إعادة جدولة موعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: 'تم إعادة جدولة أحد مواعيدك',
      bodyEn: 'One of your bookings has been rescheduled',
      notificationType: 'booking_rescheduled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_COMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'اكتمل الموعد',
      titleEn: 'Booking Completed',
      bodyAr: 'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
      bodyEn: 'Your booking is completed. You can now rate your experience',
      notificationType: 'booking_completed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_EXPIRED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'انتهى وقت الحجز',
      titleEn: 'Booking Expired',
      bodyAr: `انتهى وقت تأكيد حجزك بتاريخ ${ctx.date}`,
      bodyEn: `Your booking on ${ctx.date} has expired due to non-payment`,
      notificationType: 'booking_expired',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_NOSHOW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تغيب عن الموعد',
      titleEn: 'No-Show Recorded',
      bodyAr: `تم تسجيل تغيب عن موعدك بتاريخ ${ctx.date}`,
      bodyEn: `A no-show was recorded for your appointment on ${ctx.date}`,
      notificationType: 'booking_no_show',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_NOSHOW_REVIEW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'مراجعة حالة التغيب',
      titleEn: 'No-Show Review',
      bodyAr: `يرجى مراجعة حالة التغيب للموعد بتاريخ ${ctx.date}`,
      bodyEn: `Please review the no-show for the booking on ${ctx.date}`,
      notificationType: 'no_show_review',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_AUTOCOMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'اكتمل الموعد تلقائياً',
      titleEn: 'Booking Auto-Completed',
      bodyAr: `تم إتمام موعدك بتاريخ ${ctx.date} تلقائياً`,
      bodyEn: `Your booking on ${ctx.date} was automatically completed`,
      notificationType: 'booking_completed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.PATIENT_ARRIVED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'وصول المريض',
      titleEn: 'Patient Arrived',
      bodyAr: 'المريض وصل وجاهز للموعد',
      bodyEn: 'Patient has arrived and is ready',
      notificationType: 'patient_arrived',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.WAITLIST_SLOT_AVAILABLE]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'موعد متاح!',
      titleEn: 'Slot Available!',
      bodyAr: `أصبح هناك موعد متاح مع ${ctx.practitionerName} بتاريخ ${ctx.date}`,
      bodyEn: `A slot is now available with ${ctx.practitionerName} on ${ctx.date}`,
      notificationType: 'waitlist_slot_available',
    }),
  } as EventTemplate<never>,

  // ─── Payments ──────────────────────────────────────────────────
  [MessagingEvent.PAYMENT_RECEIVED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تم استلام الدفعة',
      titleEn: 'Payment Received',
      bodyAr: `تم استلام دفعتك بمبلغ ${ctx.amount} ريال`,
      bodyEn: `Your payment of ${ctx.amount} SAR has been received`,
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BANK_TRANSFER_SUBMITTED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تم استلام إيصال التحويل',
      titleEn: 'Transfer Receipt Submitted',
      bodyAr: `تم استلام إيصال التحويل البنكي بمبلغ ${ctx.amount} ريال وهو قيد المراجعة`,
      bodyEn: `Bank transfer receipt of ${ctx.amount} SAR received and under review`,
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.RECEIPT_REJECTED]: {
    category: 'payment',
    defaultChannels: ['push', 'sms'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم رفض إيصال التحويل البنكي',
      titleEn: 'Bank Transfer Receipt Rejected',
      bodyAr: 'تم رفض إيصال التحويل البنكي. يرجى إعادة الرفع أو التواصل معنا',
      bodyEn: 'Your bank transfer receipt was rejected. Please re-upload or contact us',
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  // ─── Groups ────────────────────────────────────────────────────
  [MessagingEvent.GROUP_SESSION_REMINDER]: {
    category: 'group',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تذكير بالجلسة الجماعية',
      titleEn: 'Group Session Reminder',
      bodyAr: `جلستك الجماعية مع ${ctx.practitionerName} غداً الساعة ${ctx.time}`,
      bodyEn: `Your group session with ${ctx.practitionerName} is tomorrow at ${ctx.time}`,
      notificationType: 'booking_reminder',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_ENROLLMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد التسجيل',
      titleEn: 'Enrollment Confirmed',
      bodyAr: `تم تأكيد تسجيلك في جلسة ${ctx.serviceName}`,
      bodyEn: `Your enrollment in ${ctx.serviceName} has been confirmed`,
      notificationType: 'group_enrollment_created',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_CAPACITY_REACHED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'اكتمل عدد المشتركين',
      titleEn: 'Group Capacity Reached',
      bodyAr: `اكتملت الجلسة الجماعية ${ctx.serviceName}`,
      bodyEn: `Group session ${ctx.serviceName} has reached full capacity`,
      notificationType: 'group_capacity_reached',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_SESSION_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد الجلسة الجماعية',
      titleEn: 'Group Session Confirmed',
      bodyAr: `تم تأكيد الجلسة الجماعية ${ctx.serviceName} بتاريخ ${ctx.date}`,
      bodyEn: `Group session ${ctx.serviceName} on ${ctx.date} is confirmed`,
      notificationType: 'group_session_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_PAYMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تأكيد الدفع',
      titleEn: 'Payment Confirmed',
      bodyAr: `تم تأكيد دفعتك بمبلغ ${ctx.amount} ريال للجلسة الجماعية`,
      bodyEn: `Your payment of ${ctx.amount} SAR for the group session is confirmed`,
      notificationType: 'group_payment_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_ATTENDANCE_MARKED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم تسجيل حضورك',
      titleEn: 'Attendance Marked',
      bodyAr: 'تم تسجيل حضورك في الجلسة',
      bodyEn: 'Your attendance has been recorded',
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  // ─── Problem Reports ───────────────────────────────────────────
  [MessagingEvent.PROBLEM_REPORT_RESOLVED]: {
    category: 'system',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم حل المشكلة',
      titleEn: 'Problem Resolved',
      bodyAr: 'تم مراجعة بلاغك وحل المشكلة المُبلَّغ عنها',
      bodyEn: 'Your problem report has been reviewed and resolved',
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,
};
