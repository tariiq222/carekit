/** Booking types */
export type BookingType = 'in_person' | 'online' | 'walk_in';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'pending_cancellation'
  | 'no_show'
  | 'expired';
export type PaymentStatus = 'pending' | 'awaiting' | 'paid' | 'refunded' | 'failed' | 'rejected';
export type PaymentMethod = 'moyasar' | 'bank_transfer' | 'cash';
export type TransferVerificationStatus =
  | 'pending' | 'matched' | 'amount_differs' | 'suspicious'
  | 'old_date' | 'unreadable' | 'approved' | 'rejected';

export interface Employee {
  id: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  specialty: string | null;
  specialtyAr: string | null;
  bio?: string;
  bioAr?: string;
  qualifications?: string[];
  rating: number;
  reviewCount: number;
  averageRating?: number;
  totalRatings?: number;
  clinicPrice?: number;
  isAvailableToday?: boolean;
  nextAvailableDate?: string;
}

export interface EmployeeAvailability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  clientId: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
    avatarUrl: string | null;
  };
  employeeId: string;
  employee: Employee;
  serviceId?: string;
  type: BookingType;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string;
  zoomLink?: string;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  categoryId: string;
  category?: ServiceCategory;
  durationMinutes: number;
  price: number;
}

export interface Rating {
  id: string;
  bookingId: string;
  clientId: string;
  employeeId: string;
  stars: number;
  comment?: string;
  createdAt: string;
  client?: {
    firstName: string;
    lastName: string;
  };
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  moyasarPaymentId?: string;
  transactionRef?: string;
  createdAt: string;
  booking?: Booking;
}

export interface BankTransferReceipt {
  id: string;
  paymentId: string;
  receiptUrl: string;
  aiVerificationStatus: TransferVerificationStatus;
  aiConfidence?: number;
  aiNotes?: string;
  extractedAmount?: number;
  extractedDate?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'booking_confirmed'
    | 'booking_completed'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'booking_expired'
    | 'booking_no_show'
    | 'booking_reminder'
    | 'booking_reminder_urgent'
    | 'booking_cancellation_rejected'
    | 'cancellation_rejected'
    | 'cancellation_requested'
    | 'no_show_review'
    | 'client_arrived'
    | 'receipt_rejected'
    | 'reminder'
    | 'payment_received'
    | 'new_rating'
    | 'problem_report'
    | 'waitlist_slot_available'
    | 'system_alert';
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  isRead: boolean;
  createdAt: string;
}
