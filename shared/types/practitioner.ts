export interface Practitioner {
  id: string;
  userId: string;
  specialtyId: string;
  bio: string | null;
  bioAr: string | null;
  experience: number;
  education: string | null;
  educationAr: string | null;
  /** @deprecated Use PractitionerServicePricing per service instead */
  priceClinic: number;
  /** @deprecated Use PractitionerServicePricing per service instead */
  pricePhone: number;
  /** @deprecated Use PractitionerServicePricing per service instead */
  priceVideo: number;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PractitionerServicePricing {
  id: string;
  practitionerId: string;
  serviceId: string;
  priceClinic: number | null;
  pricePhone: number | null;
  priceVideo: number | null;
  customDuration: number | null;
  bufferBefore: number;
  bufferAfter: number;
  availableTypes: ('clinic_visit' | 'phone_consultation' | 'video_consultation')[];
  isActive: boolean;
  service?: {
    id: string;
    nameAr: string;
    nameEn: string;
  };
}

export interface PractitionerWithUser extends Practitioner {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  specialty: {
    id: string;
    nameAr: string;
    nameEn: string;
    iconUrl: string | null;
  };
}

export interface PractitionerAvailability {
  id: string;
  practitionerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface PractitionerVacation {
  id: string;
  practitionerId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}
