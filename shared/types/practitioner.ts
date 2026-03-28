export interface Practitioner {
  id: string;
  userId: string;
  specialtyId: string;
  bio: string | null;
  bioAr: string | null;
  experience: number;
  education: string | null;
  educationAr: string | null;
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
  customDuration: number | null;
  bufferMinutes: number;
  availableTypes: ('in_person' | 'online' | 'walk_in')[];
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
