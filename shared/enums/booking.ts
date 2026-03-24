export enum BookingType {
  CLINIC_VISIT = 'clinic_visit',
  PHONE_CONSULTATION = 'phone_consultation',
  VIDEO_CONSULTATION = 'video_consultation',
  WALK_IN = 'walk_in',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PENDING_CANCELLATION = 'pending_cancellation',
  NO_SHOW = 'no_show',
  EXPIRED = 'expired',
}

export enum WaitlistStatus {
  WAITING = 'waiting',
  NOTIFIED = 'notified',
  BOOKED = 'booked',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}
