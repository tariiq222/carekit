/**
 * Centralized error message strings for all backend modules.
 *
 * Usage:
 *   import { ERR } from '../../common/constants/error-messages.js';
 *   throw new NotFoundException({ statusCode: 404, message: ERR.booking.notFound, error: 'NOT_FOUND' });
 *
 * Keeping messages here (instead of inline) enables:
 *   - Frontend i18n mapping by stable message string
 *   - Consistent wording across modules
 *   - Single place to update when copy changes
 */

export const ERR = {
  booking: {
    notFound: 'Booking not found',
    conflict: 'Practitioner already has a booking at this time',
    pastDate: 'Cannot book in the past',
    tooFarInAdvance: (days: number) =>
      `Bookings cannot be made more than ${days} days in advance`,
    leadTimeViolation: (minutes: number) =>
      `Booking must be at least ${minutes} minutes in advance`,
    walkInNotAllowed: 'Walk-in bookings are not allowed',
    payAtClinicForbidden:
      'Only staff or admin can create pay-at-clinic bookings',
    rescheduleNotAllowed: 'Patient self-reschedule is not enabled',
    rescheduleOwnership: 'You can only reschedule your own bookings',
    rescheduleLimitReached: (max: number) =>
      `Maximum reschedule limit (${max}) reached`,
    rescheduleTooLate: (hours: number) =>
      `Must reschedule at least ${hours} hours before the appointment`,
    invalidRescheduleInput:
      'At least one of date or startTime must be provided',
    invalidStatusForReschedule: (status: string) =>
      `Cannot reschedule a booking with status '${status}'`,
  },

  practitioner: {
    notFound: 'Practitioner not found',
    notAcceptingBookings:
      'Practitioner is not accepting new bookings at this time',
    branchMismatch: 'Practitioner is not assigned to this branch',
  },

  service: {
    notFound: 'Service not found',
    notOffered: 'Practitioner does not offer this service',
    inactive: 'This service is currently unavailable for this practitioner',
    typeNotAvailable: (type: string) =>
      `Booking type '${type}' is not available for this service`,
  },

  branch: {
    notFound: 'Branch not found',
  },

  patient: {
    notFound: 'Patient not found',
  },

  auth: {
    invalidToken: 'Invalid token',
    sessionExpired: 'Session expired — please log in again',
    forbidden: 'You do not have permission to perform this action',
  },
} as const;
