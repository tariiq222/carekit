/**
 * Shared fixtures and mock factory for PaymentsService test suites.
 */

export const mockBookingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const mockPaymentId = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
export const mockReceiptId = 'c3d4e5f6-a7b8-9012-cdef-012345678902';
export const mockReviewerId = 'd4e5f6a7-b8c9-0123-defa-123456789013';
export const mockUserId = 'e5f6a7b8-c9d0-1234-efab-234567890124';

export const mockBooking = {
  id: mockBookingId,
  patientId: mockUserId,
  practitionerId: 'practitioner-uuid-1',
  serviceId: 'service-uuid-1',
  type: 'clinic_visit',
  status: 'confirmed',
  deletedAt: null,
  practitioner: { priceClinic: 20000, pricePhone: 15000, priceVideo: 18000 },
  service: { price: 10000 },
};

export const mockPayment = {
  id: mockPaymentId,
  bookingId: mockBookingId,
  amount: 15000,
  vatAmount: 0,
  totalAmount: 15000,
  method: 'bank_transfer' as const,
  status: 'pending' as const,
  moyasarPaymentId: null,
  transactionRef: null,
  createdAt: new Date('2026-03-20'),
  updatedAt: new Date('2026-03-20'),
  booking: {
    id: mockBookingId,
    patient: { id: mockUserId, firstName: 'أحمد', lastName: 'الراشد', email: 'ahmed@example.com', phone: null },
    practitioner: {
      id: 'practitioner-uuid-1',
      user: { id: 'user-uuid-1', firstName: 'خالد', lastName: 'الفهد' },
      specialty: { nameEn: 'Cardiology', nameAr: 'أمراض القلب' },
    },
  },
  receipt: null,
  invoice: null,
};

export const mockMoyasarPayment = {
  ...mockPayment,
  method: 'moyasar' as const,
  moyasarPaymentId: 'moyasar-pay-id-001',
  status: 'paid' as const,
};

export const mockReceipt = {
  id: mockReceiptId,
  paymentId: mockPaymentId,
  receiptUrl: 'https://example.com/receipt.jpg',
  aiVerificationStatus: 'pending' as const,
  aiConfidence: null,
  aiNotes: null,
  extractedAmount: null,
  extractedDate: null,
  reviewedById: null,
  reviewedAt: null,
  adminNotes: null,
  createdAt: new Date('2026-03-20'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockPrisma(): any {
  return {
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    booking: { findFirst: jest.fn() },
    bankTransferReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockMoyasarService(): any {
  return {
    createMoyasarPayment: jest.fn(),
    handleMoyasarWebhook: jest.fn(),
    refund: jest.fn(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockBankTransferService(): any {
  return {
    uploadReceipt: jest.fn(),
    reviewReceipt: jest.fn(),
    uploadBankTransferReceipt: jest.fn(),
    verifyBankTransfer: jest.fn(),
  };
}
