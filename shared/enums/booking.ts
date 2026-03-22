export enum BookingType {
  CLINIC_VISIT = 'clinic_visit',
  PHONE_CONSULTATION = 'phone_consultation',
  VIDEO_CONSULTATION = 'video_consultation',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PENDING_CANCELLATION = 'pending_cancellation',
}
