/** Booking types */
export type BookingType = 'clinic_visit' | 'phone_consultation' | 'video_consultation';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'pending_cancellation';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type PaymentMethod = 'moyasar' | 'bank_transfer';
export type TransferVerificationStatus =
  | 'pending' | 'matched' | 'amount_differs' | 'suspicious'
  | 'old_date' | 'unreadable' | 'approved' | 'rejected';

export interface Specialty {
  id: string;
  nameAr: string;
  nameEn: string;
  icon?: string;
  practitionerCount?: number;
}

export interface Practitioner {
  id: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  specialtyId: string;
  specialty: Specialty;
  bio?: string;
  bioAr?: string;
  qualifications?: string[];
  clinicPrice: number;
  phonePrice: number;
  videoPrice: number;
  averageRating: number;
  totalRatings: number;
  isAvailableToday?: boolean;
  nextAvailableDate?: string;
}

export interface PractitionerAvailability {
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
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
    avatarUrl: string | null;
  };
  practitionerId: string;
  practitioner: Practitioner;
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
  patientId: string;
  practitionerId: string;
  stars: number;
  comment?: string;
  createdAt: string;
  patient?: {
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
  type: 'booking_confirmed' | 'booking_cancelled' | 'reminder' | 'payment_received' | 'new_rating' | 'problem_report';
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  isRead: boolean;
  createdAt: string;
}
