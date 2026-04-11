import type { BookingStatus, BookingType, CancelledBy, RecurringPattern, RefundType } from '../enums/booking';

export interface Booking {
  id: string;
  patientId: string | null;
  branchId: string | null;
  practitionerId: string;
  serviceId: string;
  practitionerServiceId: string;
  type: BookingType;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes: string | null;
  adminNotes: string | null;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomHostUrl: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  noShowAt: string | null;
  rescheduledFromId: string | null;
  rescheduleCount: number;
  suggestedRefundType: RefundType | null;
  isWalkIn: boolean;
  recurringGroupId: string | null;
  recurringPattern: RecurringPattern | null;
  bookedPrice: number | null;
  bookedDuration: number | null;
  durationOptionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BookingWithRelations extends Booking {
  patient?: { id: string; firstName: string; lastName: string; phone: string | null };
  practitioner?: { id: string; user: { firstName: string; lastName: string }; specialty: { nameAr: string; nameEn: string } };
  service?: { nameAr: string; nameEn: string; price: number; duration: number };
  payment?: { status: string; totalAmount: number };
  rating?: { stars: number; comment: string | null };
}

export interface CreateBookingRequest {
  practitionerId: string;
  serviceId: string;
  type: BookingType;
  date: string;
  startTime: string;
  notes?: string;
}
