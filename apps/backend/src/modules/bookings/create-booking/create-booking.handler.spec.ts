import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreateBookingHandler } from './create-booking.handler';

const futureDate = new Date(Date.now() + 86400_000); // tomorrow

const mockBooking = {
  id: 'book-1', tenantId: 'tenant-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate, durationMins: 60, price: 200,
  currency: 'SAR', status: 'PENDING',
};

const buildPrisma = () => ({
  booking: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockBooking),
  },
});

const dto = {
  tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
  employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate, durationMins: 60, price: 200,
};

describe('CreateBookingHandler', () => {
  it('creates booking when no conflict', async () => {
    const prisma = buildPrisma();
    const handler = new CreateBookingHandler(prisma as never);
    const result = await handler.execute(dto);
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

  it('defaults currency to SAR and type to INDIVIDUAL', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'SAR', bookingType: 'INDIVIDUAL' }) }),
    );
  });
});
