import type { BookingStatus, BookingType } from '../enums/booking';

export interface Booking {
  id: string;
  patientId: string | null;
  practitionerId: string;
  serviceId: string;
  type: BookingType;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes: string | null;
  zoomJoinUrl: string | null;
  zoomHostUrl: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
