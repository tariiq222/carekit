import { ConflictException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateBookingHandler } from './create-booking.handler';

const futureDate = new Date(Date.now() + 86400_000);

const mockBooking = {
  id: 'book-1', tenantId: 'tenant-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate, durationMins: 60, price: 200,
  currency: 'SAR', status: 'PENDING',
};

const mockService = {
  id: 'svc-1', tenantId: 'tenant-1', durationMins: 60, price: 200, currency: 'SAR',
};

const buildPrisma = () => ({
  booking: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockBooking),
  },
  service: {
    findUnique: jest.fn().mockResolvedValue(mockService),
  },
});

const dto = {
  tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
  employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate,
};

describe('CreateBookingHandler', () => {
  it('creates booking with price and duration derived from Service', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(prisma as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', employeeId: 'emp-1' }) }),
    );
    expect(result.id).toBe('book-1');
  });

  it('throws ConflictException when employee has overlapping booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
    await expect(new CreateBookingHandler(prisma as never).execute(dto)).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400_000);
    await expect(
      new CreateBookingHandler(buildPrisma() as never).execute({ ...dto, scheduledAt: pastDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults currency to SAR and type to INDIVIDUAL from Service', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'SAR', bookingType: 'INDIVIDUAL' }) }),
    );
  });

  it('throws NotFoundException when service does not exist', async () => {
    const prisma = buildPrisma();
    prisma.service.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when service belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.service.findUnique = jest.fn().mockResolvedValue({ ...mockService, tenantId: 'other-tenant' });
    await expect(new CreateBookingHandler(prisma as never).execute(dto)).rejects.toThrow(ForbiddenException);
  });
});
