import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { CreateGuestBookingDto } from './create-guest-booking.dto';
import type { OtpPurpose } from '@prisma/client';

export type CreateGuestBookingCommand = CreateGuestBookingDto & {
  identifier: string;
};

const DEFAULT_VAT_RATE = 0.15;

@Injectable()
export class CreateGuestBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(dto: CreateGuestBookingCommand) {
    const scheduledAt = new Date(dto.startsAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const employeeService = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: dto.employeeId, serviceId: dto.serviceId } },
    });
    if (!employeeService) {
      throw new BadRequestException('Employee does not provide this service');
    }

    const resolved = await this.priceResolver.resolve({
      serviceId: dto.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: null,
      bookingType: null,
    });

    const durationMins = resolved.durationMins;
    const price = resolved.price;
    const currency = resolved.currency;
    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    const result = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          employeeId: dto.employeeId,
          status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
          scheduledAt: { lt: endsAt },
          endsAt: { gt: scheduledAt },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException('Employee already has a booking in this time slot');
      }

      let client = await tx.client.findFirst({
        where: {
          OR: [
            { phone: dto.client.phone },
            { email: dto.client.email },
          ],
        },
      });

      const now = new Date();

      if (!client) {
        client = await tx.client.create({
          data: {
            name: dto.client.name,
            phone: dto.client.phone,
            email: dto.client.email,
            gender: dto.client.gender,
            emailVerified: now,
            source: 'ONLINE',
            accountType: 'WALK_IN',
          },
        });
      } else {
        await tx.client.update({
          where: { id: client.id },
          data: {
            name: dto.client.name,
            gender: dto.client.gender ?? client.gender,
          },
        });
      }

      const booking = await tx.booking.create({
        data: {
          branchId: dto.branchId,
          clientId: client.id,
          employeeId: dto.employeeId,
          serviceId: dto.serviceId,
          durationOptionId: resolved.durationOptionId || null,
          scheduledAt,
          endsAt,
          durationMins,
          price,
          currency,
          bookingType: 'INDIVIDUAL',
          notes: dto.client.notes,
          status: 'AWAITING_PAYMENT',
        },
      });

      const subtotal = Number(price);
      const vatAmt = parseFloat((subtotal * DEFAULT_VAT_RATE).toFixed(2));
      const total = subtotal + vatAmt;

      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          clientId: client.id,
          employeeId: dto.employeeId,
          bookingId: booking.id,
          subtotal,
          discountAmt: 0,
          vatRate: DEFAULT_VAT_RATE,
          vatAmt,
          total,
          status: 'ISSUED',
          issuedAt: now,
        },
      });

      return { bookingId: booking.id, invoiceId: invoice.id, totalHalalat: Math.round(total * 100) };
    });

    return result;
  }
}
