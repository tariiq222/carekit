export enum BookingType {
  IN_PERSON = 'in_person',
  ONLINE = 'online',
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

export enum CancelledBy {
  CLIENT = 'client',
  EMPLOYEE = 'employee',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export enum RecurringPattern {
  DAILY = 'daily',
  EVERY_2_DAYS = 'every_2_days',
  EVERY_3_DAYS = 'every_3_days',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

export enum RefundType {
  FULL = 'full',
  PARTIAL = 'partial',
  NONE = 'none',
}

export enum BookingFlowOrder {
  SERVICE_FIRST = 'service_first',
  EMPLOYEE_FIRST = 'employee_first',
  BOTH = 'both',
}
