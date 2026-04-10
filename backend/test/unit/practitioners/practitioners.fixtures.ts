/**
 * Shared fixtures and mock factory for PractitionersService test suites.
 */

export const mockUser = {
  id: 'user-uuid-1',
  email: 'doctor@carekit-test.com',
  firstName: 'خالد',
  lastName: 'الفهد',
  phone: '+966501000004',
  gender: 'male',
  isActive: true,
};

export const mockPractitioner = {
  id: 'practitioner-uuid-1',
  userId: mockUser.id,
  specialty: 'Cardiology',
  specialtyAr: 'أمراض القلب',
  bio: 'Experienced cardiologist',
  bioAr: 'طبيب قلب ذو خبرة',
  experience: 10,
  education: 'MD, Fellowship in Cardiology',
  educationAr: 'دكتوراه في الطب، زمالة أمراض القلب',
  priceClinic: 20000,
  pricePhone: 15000,
  priceVideo: 18000,
  rating: 4.5,
  reviewCount: 20,
  isActive: true,
  isAcceptingBookings: true,
  deletedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  user: mockUser,
};

export const mockAvailability = [
  { id: 'avail-1', practitionerId: mockPractitioner.id, dayOfWeek: 0, startTime: '09:00', endTime: '12:00', isActive: true },
  { id: 'avail-2', practitionerId: mockPractitioner.id, dayOfWeek: 0, startTime: '14:00', endTime: '17:00', isActive: true },
  { id: 'avail-3', practitionerId: mockPractitioner.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
];

export const mockVacation = {
  id: 'vacation-uuid-1',
  practitionerId: mockPractitioner.id,
  startDate: new Date('2026-04-10'),
  endDate: new Date('2026-04-15'),
  reason: 'عطلة عيد الفطر',
  createdAt: new Date('2026-03-01'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockPrisma(): any {
  return {
    practitioner: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    practitionerAvailability: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    practitionerVacation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    practitionerBreak: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn() },
    booking: { findMany: jest.fn() },
    practitionerService: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { bufferMinutes: 0 } }),
    },
    service: { findUnique: jest.fn() },
    $transaction: jest.fn((fnOrArray: unknown) => {
      if (typeof fnOrArray === 'function') return (fnOrArray as (tx: unknown) => Promise<unknown>)(createMockPrisma());
      return Promise.all(fnOrArray as Promise<unknown>[]);
    }),
  };
}
