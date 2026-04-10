/**
 * Regression tests for CRITICAL fix #3:
 * depositEnabled/depositPercent were dead fields — booking-payment.helper.ts
 * always charged 100% of resolvedPrice ignoring service deposit configuration.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingPaymentHelper } from '../../../src/modules/bookings/booking-payment.helper.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findFirst: jest.fn() },
  payment: { create: jest.fn().mockResolvedValue({ id: 'pay-uuid' }) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSettings: any = {
  get: jest.fn().mockResolvedValue({ walkInPaymentRequired: true }),
};

const BOOKING_ID = 'booking-uuid-1';

describe('BookingPaymentHelper — deposit logic (CRITICAL #3)', () => {
  let service: BookingPaymentHelper;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPaymentHelper,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get(BookingPaymentHelper);
  });

  it('REGRESSION: charges 50% deposit when depositEnabled=true, depositPercent=50', async () => {
    // Before fix: 20000 always charged. After fix: 10000 (50%) charged.
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 20000, false, undefined, true, 50);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(10000);      // 50% of 20000
    expect(call.data.vatAmount).toBe(1500);    // 15% of 10000
    expect(call.data.totalAmount).toBe(11500);
    expect(call.data.method).toBe('moyasar');
    expect(call.data.status).toBe('awaiting');
  });

  it('charges 30% deposit correctly', async () => {
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 1000, false, undefined, true, 30);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(300); // Math.round(1000 * 30 / 100)
  });

  it('charges full price when depositEnabled=false (deposit disabled)', async () => {
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 20000, false, undefined, false, 50);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(20000);
  });

  it('charges full price when depositPercent=100', async () => {
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 20000, false, undefined, true, 100);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(20000);
  });

  it('charges full price when no deposit params provided (backward compat)', async () => {
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 20000);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(20000);
  });

  it('cash payment (payAtClinic=true) always charges full price ignoring deposit', async () => {
    await service.createPaymentIfNeeded(BOOKING_ID, 'in_person', 20000, true, [{ slug: 'staff' }], true, 30);

    const call = mockPrisma.payment.create.mock.calls[0][0];
    expect(call.data.amount).toBe(20000); // cash = full price always
    expect(call.data.method).toBe('cash');
    expect(call.data.status).toBe('paid');
  });
});
