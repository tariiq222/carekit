export enum MessagingEvent {
  // Auth
  OTP_REQUESTED = 'auth.otp_requested',
  WELCOME = 'auth.welcome',
  PRACTITIONER_WELCOME = 'auth.practitioner_welcome',

  // Bookings
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CONFIRMED_PRACTITIONER = 'booking.confirmed_practitioner',
  BOOKING_REMINDER = 'booking.reminder',
  BOOKING_REMINDER_URGENT = 'booking.reminder_urgent',
  BOOKING_CANCELLED = 'booking.cancelled',
  BOOKING_CANCELLED_BY_PRACTITIONER = 'booking.cancelled_by_practitioner',
  BOOKING_CANCELLATION_REQUESTED = 'booking.cancellation_requested',
  BOOKING_CANCELLATION_REJECTED = 'booking.cancellation_rejected',
  BOOKING_RESCHEDULED = 'booking.rescheduled',
  BOOKING_RESCHEDULED_PRACTITIONER = 'booking.rescheduled_practitioner',
  BOOKING_COMPLETED = 'booking.completed',
  BOOKING_EXPIRED = 'booking.expired',
  BOOKING_NOSHOW = 'booking.noshow',
  BOOKING_NOSHOW_REVIEW = 'booking.noshow_review',
  BOOKING_AUTOCOMPLETED = 'booking.autocompleted',
  PATIENT_ARRIVED = 'booking.patient_arrived',
  WAITLIST_SLOT_AVAILABLE = 'booking.waitlist_slot_available',

  // Payments
  PAYMENT_RECEIVED = 'payment.received',
  BANK_TRANSFER_SUBMITTED = 'payment.bank_transfer_submitted',
  RECEIPT_REJECTED = 'payment.receipt_rejected',

  // Groups
  GROUP_SESSION_REMINDER = 'group.session_reminder',
  GROUP_ENROLLMENT_CONFIRMED = 'group.enrollment_confirmed',
  GROUP_CAPACITY_REACHED = 'group.capacity_reached',
  GROUP_SESSION_CONFIRMED = 'group.session_confirmed',
  GROUP_PAYMENT_CONFIRMED = 'group.payment_confirmed',
  GROUP_ATTENDANCE_MARKED = 'group.attendance_marked',

  // Problem reports
  PROBLEM_REPORT_RESOLVED = 'problem.resolved',
}
