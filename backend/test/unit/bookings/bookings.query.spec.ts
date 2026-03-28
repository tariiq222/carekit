/**
 * BookingsService — Query Tests
 * Covers: findAll (pagination + filters), findOne, findMyBookings, findTodayBookings
 */
import { NotFoundException } from '@nestjs/common';
import { createBookingsTestModule, BookingsTestContext } from './bookings.test-module.js';
import { mockBooking, mockPractitioner, mockPatientId } from './bookings.fixtures.js';

const emptyPage = { items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } };
const singlePage = { items: [mockBooking], meta: { page: 1, perPage: 20, total: 1, totalPages: 1 } };

describe('BookingsService — findAll', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should return paginated bookings with default page=1, perPage=20', async () => {
    ctx.mockQueryService.findAll.mockResolvedValue(singlePage);

    const result = await ctx.service.findAll({});

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toMatchObject({ page: 1, perPage: 20, total: 1 });
    expect(ctx.mockQueryService.findAll).toHaveBeenCalledWith({});
  });

  it('should apply pagination parameters', async () => {
    ctx.mockQueryService.findAll.mockResolvedValue({
      items: [],
      meta: { page: 3, perPage: 10, total: 50, totalPages: 5 },
    });

    const result = await ctx.service.findAll({ page: 3, perPage: 10 });

    expect(result.meta.page).toBe(3);
    expect(result.meta.totalPages).toBe(5);
    expect(ctx.mockQueryService.findAll).toHaveBeenCalledWith({ page: 3, perPage: 10 });
  });

  it.each([
    [{ status: 'pending' }],
    [{ type: 'online' }],
    [{ practitionerId: mockPractitioner.id }],
    [{ patientId: mockPatientId }],
    [{ dateFrom: '2026-06-01', dateTo: '2026-06-30' }],
  ])('should forward filter %o to queryService', async (filter) => {
    ctx.mockQueryService.findAll.mockResolvedValue(emptyPage);

    await ctx.service.findAll(filter);

    expect(ctx.mockQueryService.findAll).toHaveBeenCalledWith(filter);
  });
});

describe('BookingsService — findOne', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should return a booking with all relations', async () => {
    ctx.mockQueryService.findOne.mockResolvedValue(mockBooking);

    const result = await ctx.service.findOne(mockBooking.id);

    expect(result.id).toBe(mockBooking.id);
    expect(result.patient).toBeDefined();
    expect(result.practitioner).toBeDefined();
    expect(result.service).toBeDefined();
    expect(ctx.mockQueryService.findOne).toHaveBeenCalledWith(mockBooking.id);
  });

  it('should throw NotFoundException for non-existent booking', async () => {
    ctx.mockQueryService.findOne.mockRejectedValue(
      new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' }),
    );

    await expect(ctx.service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});

describe('BookingsService — findMyBookings', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should return only bookings belonging to the patient', async () => {
    ctx.mockQueryService.findMyBookings.mockResolvedValue(singlePage);

    const result = await ctx.service.findMyBookings(mockPatientId);

    expect(ctx.mockQueryService.findMyBookings).toHaveBeenCalledWith(mockPatientId);
    expect(result.items).toHaveLength(1);
  });

  it('should return empty list for patient with no bookings', async () => {
    ctx.mockQueryService.findMyBookings.mockResolvedValue(emptyPage);

    const result = await ctx.service.findMyBookings('new-patient-id');

    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});

describe('BookingsService — findTodayBookings', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should return today bookings from queryService', async () => {
    ctx.mockQueryService.findTodayBookings.mockResolvedValue([mockBooking]);

    const result = await ctx.service.findTodayBookings(mockPractitioner.userId);

    expect(result).toEqual([mockBooking]);
    expect(ctx.mockQueryService.findTodayBookings).toHaveBeenCalledWith(mockPractitioner.userId);
  });

  it('should throw NotFoundException if user is not a practitioner', async () => {
    ctx.mockQueryService.findTodayBookings.mockRejectedValue(
      new NotFoundException({ statusCode: 404, message: 'Practitioner not found', error: 'NOT_FOUND' }),
    );

    await expect(
      ctx.service.findTodayBookings('non-practitioner-user-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
