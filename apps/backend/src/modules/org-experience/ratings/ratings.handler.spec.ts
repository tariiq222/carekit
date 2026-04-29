import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { SubmitRatingHandler } from './submit-rating.handler';
import { ListRatingsHandler } from './list-ratings.handler';
import { TenantContextService } from '../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockRating = {
  id: 'rating-1',
  organizationId: DEFAULT_ORG,
  bookingId: 'booking-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  score: 5,
  comment: 'ممتاز',
  isPublic: false,
  createdAt: new Date(),
};

const completedBooking = {
  id: 'booking-1',
  status: BookingStatus.COMPLETED,
  clientId: 'client-1',
  employeeId: 'emp-1',
};

const buildPrisma = () => ({
  rating: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockRating),
    findMany: jest.fn().mockResolvedValue([mockRating]),
    count: jest.fn().mockResolvedValue(1),
  },
  booking: {
    findFirst: jest.fn().mockResolvedValue(completedBooking),
  },
  $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops as Promise<unknown>[])),
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

const validDto = { bookingId: 'booking-1', clientId: 'client-1', employeeId: 'emp-1', score: 5 };

describe('SubmitRatingHandler', () => {
  it('creates rating scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    const result = await handler.execute(validDto);
    expect(prisma.rating.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(result.score).toBe(5);
  });

  it('throws BadRequestException for score outside 1–5', async () => {
    const prisma = buildPrisma();
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute({ ...validDto, score: 6 })).rejects.toThrow(BadRequestException);
    await expect(handler.execute({ ...validDto, score: 0 })).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when booking does not exist (or cross-tenant)', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute(validDto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when booking is not COMPLETED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...completedBooking,
      status: BookingStatus.CONFIRMED,
    });
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute(validDto)).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when clientId does not own the booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...completedBooking,
      clientId: 'someone-else',
    });
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute(validDto)).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when employeeId does not match booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...completedBooking,
      employeeId: 'different-employee',
    });
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute(validDto)).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when rating already exists', async () => {
    const prisma = buildPrisma();
    prisma.rating.findUnique = jest.fn().mockResolvedValue(mockRating);
    const handler = new SubmitRatingHandler(prisma as never, buildTenant());
    await expect(handler.execute(validDto)).rejects.toThrow(ConflictException);
  });
});

describe('ListRatingsHandler', () => {
  it('returns paginated ratings scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListRatingsHandler(prisma as never, buildTenant());
    const result = await handler.execute({});
    expect(prisma.rating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('filters by employeeId within org', async () => {
    const prisma = buildPrisma();
    const handler = new ListRatingsHandler(prisma as never, buildTenant());
    await handler.execute({ employeeId: 'emp-1' });
    const call = (prisma.rating.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.employeeId).toBe('emp-1');
    expect(call.where.organizationId).toBe(DEFAULT_ORG);
  });
});
