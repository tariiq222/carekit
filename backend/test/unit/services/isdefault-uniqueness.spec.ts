/**
 * Regression tests for HIGH fix #8:
 * isDefault had no uniqueness constraint — multiple duration options per service
 * could all have isDefault=true, causing ambiguous default resolution in PriceResolverService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ServiceBookingTypeService } from '../../../src/modules/services/service-booking-type.service.js';
import { DurationOptionsService } from '../../../src/modules/services/duration-options.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';

// ── minimal mocks ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  serviceBookingType: { deleteMany: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  serviceDurationOption: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockServices: any = {
  ensureExists: jest.fn().mockResolvedValue({}),
  invalidateServicesCache: jest.fn().mockResolvedValue(undefined),
};

// ── ServiceBookingTypeService ─────────────────────────────────────────────────

describe('ServiceBookingTypeService — isDefault uniqueness (fix #8)', () => {
  let service: ServiceBookingTypeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction = jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));
    mockPrisma.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.serviceBookingType.create.mockResolvedValue({});
    mockPrisma.serviceBookingType.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceBookingTypeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ServicesService, useValue: mockServices },
      ],
    }).compile();

    service = module.get(ServiceBookingTypeService);
  });

  it('REGRESSION: rejects when multiple durationOptions have isDefault=true', async () => {
    await expect(
      service.setBookingTypes('svc-1', {
        types: [{
          bookingType: 'in_person',
          price: 100,
          duration: 30,
          durationOptions: [
            { label: 'Short', durationMinutes: 30, price: 100, isDefault: true },
            { label: 'Long',  durationMinutes: 60, price: 200, isDefault: true }, // second default!
          ],
        }],
      }),
    ).rejects.toMatchObject({ response: { error: 'MULTIPLE_DEFAULTS' } });
  });

  it('auto-assigns first option as default when none is marked', async () => {
    await service.setBookingTypes('svc-1', {
      types: [{
        bookingType: 'in_person',
        price: 100,
        duration: 30,
        durationOptions: [
          { label: 'Short', durationMinutes: 30, price: 100, isDefault: false },
          { label: 'Long',  durationMinutes: 60, price: 200, isDefault: false },
        ],
      }],
    });

    const createCall = mockPrisma.serviceBookingType.create.mock.calls[0][0];
    const opts = createCall.data.durationOptions.createMany.data;
    expect(opts[0].isDefault).toBe(true);  // first auto-assigned
    expect(opts[1].isDefault).toBe(false);
  });

  it('accepts exactly one isDefault=true', async () => {
    await expect(
      service.setBookingTypes('svc-1', {
        types: [{
          bookingType: 'in_person',
          price: 100,
          duration: 30,
          durationOptions: [
            { label: 'Short', durationMinutes: 30, price: 100, isDefault: false },
            { label: 'Long',  durationMinutes: 60, price: 200, isDefault: true },
          ],
        }],
      }),
    ).resolves.not.toThrow();
  });
});

// ── DurationOptionsService ────────────────────────────────────────────────────

describe('DurationOptionsService — isDefault uniqueness (fix #8)', () => {
  let service: DurationOptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction = jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));
    mockPrisma.serviceDurationOption.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.serviceDurationOption.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.serviceDurationOption.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DurationOptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ServicesService, useValue: mockServices },
      ],
    }).compile();

    service = module.get(DurationOptionsService);
  });

  it('REGRESSION: rejects when multiple options have isDefault=true', async () => {
    await expect(
      service.setDurationOptions('svc-1', {
        options: [
          { label: 'A', durationMinutes: 30, price: 100, isDefault: true },
          { label: 'B', durationMinutes: 60, price: 200, isDefault: true },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'MULTIPLE_DEFAULTS' } });
  });

  it('auto-assigns first as default when none marked', async () => {
    await service.setDurationOptions('svc-1', {
      options: [
        { label: 'A', durationMinutes: 30, price: 100, isDefault: false },
        { label: 'B', durationMinutes: 60, price: 200, isDefault: false },
      ],
    });

    const createCall = mockPrisma.serviceDurationOption.createMany.mock.calls[0][0];
    expect(createCall.data[0].isDefault).toBe(true);
    expect(createCall.data[1].isDefault).toBe(false);
  });

  it('accepts empty options array', async () => {
    await expect(service.setDurationOptions('svc-1', { options: [] })).resolves.not.toThrow();
  });
});
