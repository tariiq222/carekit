// ══════════════════════════════════════════════════════════════
//  Report interfaces — shared between service, controller, export
// ══════════════════════════════════════════════════════════════

export interface RevenueByMonth {
  month: string;
  revenue: number;
  bookings: number;
}

export interface RevenueByPractitioner {
  practitionerId: string;
  name: string;
  revenue: number;
  bookings: number;
}

export interface RevenueByService {
  serviceId: string;
  name: string;
  revenue: number;
  bookings: number;
}

export interface RevenueReport {
  totalRevenue: number;
  totalBookings: number;
  paidBookings: number;
  averagePerBooking: number;
  byMonth: RevenueByMonth[];
  byPractitioner: RevenueByPractitioner[];
  byService: RevenueByService[];
}

export interface BookingByDay {
  date: string;
  count: number;
}

export interface BookingReport {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    pending_cancellation: number;
  };
  byType: {
    clinic_visit: number;
    phone_consultation: number;
    video_consultation: number;
  };
  byDay: BookingByDay[];
}

export interface PractitionerRating {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
  patientName: string;
}

export interface PractitionerReport {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  ratings: PractitionerRating[];
}

// ══════════════════════════════════════════════════════════════
//  Raw query result types (DB-level aggregation rows)
// ══════════════════════════════════════════════════════════════

export interface RevenueByMonthRow {
  month: Date;
  bookings: number;
  revenue: bigint;
}

export interface RevenueByPractitionerRow {
  practitioner_id: string;
  first_name: string;
  last_name: string;
  bookings: number;
  revenue: bigint;
}

export interface RevenueByServiceRow {
  service_id: string;
  name_ar: string;
  name_en: string;
  bookings: number;
  revenue: bigint;
}

export interface BookingStatusRow {
  status: string;
  count: bigint;
}

export interface BookingTypeRow {
  type: string;
  count: bigint;
}

export interface BookingByDayRow {
  date: Date;
  count: bigint;
}
