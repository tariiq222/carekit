export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_RESCHEDULED = 'booking_rescheduled',
  BOOKING_EXPIRED = 'booking_expired',
  CANCELLATION_REJECTED = 'cancellation_rejected',
  CANCELLATION_REQUESTED = 'cancellation_requested',
  REMINDER = 'reminder',
  PAYMENT_RECEIVED = 'payment_received',
  NEW_RATING = 'new_rating',
  PROBLEM_REPORT = 'problem_report',
  WAITLIST_SLOT_AVAILABLE = 'waitlist_slot_available',
  SYSTEM_ALERT = 'system_alert',
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}
