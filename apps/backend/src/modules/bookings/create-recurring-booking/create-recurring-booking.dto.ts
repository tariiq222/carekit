import { BookingType, RecurringFrequency } from '@prisma/client';

/**
 * Payload for creating a recurring series of bookings.
 *
 * Exactly one of `occurrences` or `until` must be provided — the handler
 * validates this and throws BadRequestException otherwise.
 *
 * For CUSTOM frequency, `customDates` must be provided; `intervalDays` is ignored.
 * For DAILY/WEEKLY, `intervalDays` controls the gap (default 1 for DAILY, 7 for WEEKLY).
 */
export interface CreateRecurringBookingDto {
  tenantId: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  /** First occurrence */
  scheduledAt: Date;
  durationMins: number;
  price: number;
  currency?: string;
  bookingType?: BookingType;
  notes?: string;
  expiresAt?: Date;

  frequency: RecurringFrequency;
  /** Required for DAILY/WEEKLY. Ignored for CUSTOM. */
  intervalDays?: number;
  /** Number of bookings to create (including the first). Mutually exclusive with `until`. */
  occurrences?: number;
  /** Last possible date for bookings (inclusive). Mutually exclusive with `occurrences`. */
  until?: Date;
  /** Required when frequency === 'CUSTOM'. Exact list of dates (time portion used). */
  customDates?: Date[];
  /**
   * When true, skip conflicting slots silently instead of aborting the whole series.
   * Default: false (abort on first conflict).
   */
  skipConflicts?: boolean;
}
