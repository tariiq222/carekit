import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../organization/services/price-resolver.service';
import type { CreateBookingDto } from './create-booking.dto';

@Injectable()
export class CreateBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceResolver: PriceResolverService,
  ) {}

  async execute(dto: CreateBookingDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    // Verify employee exists and belongs to the same tenant.
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.tenantId !== dto.tenantId) {
      throw new ForbiddenException('Employee does not belong to tenant');
    }

    // Verify service belongs to this tenant before resolving price.
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    if (service.tenantId !== dto.tenantId) throw new ForbiddenException('Service does not belong to tenant');

    // Verify employee actually provides this service and get the employeeService id.
    const employeeService = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: dto.employeeId, serviceId: dto.serviceId } },
    });
    if (!employeeService) {
      throw new BadRequestException('Employee does not provide this service');
    }

    // Resolve price + duration via PriceResolverService (3-tier: employee override → duration option → service base).
    const resolved = await this.priceResolver.resolve({
      tenantId: dto.tenantId,
      serviceId: dto.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: dto.durationOptionId ?? null,
      bookingType: dto.bookingType ?? null,
    });

    const durationMins = resolved.durationMins;
    const price = resolved.price;
    const currency = dto.currency ?? resolved.currency;

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: dto.tenantId,
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: endsAt },
        endsAt: { gt: scheduledAt },
      },
    });
    if (conflict) {
      throw new ConflictException('Employee already has a booking in this time slot');
    }

    return this.prisma.booking.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        clientId: dto.clientId,
        employeeId: dto.employeeId,
        serviceId: dto.serviceId,
        durationOptionId: resolved.durationOptionId || null,
        scheduledAt,
        endsAt,
        durationMins,
        price,
        currency,
        bookingType: dto.bookingType ?? 'INDIVIDUAL',
        notes: dto.notes,
        expiresAt: dto.expiresAt,
        groupSessionId: dto.groupSessionId,
        status: 'PENDING',
      },
    });
  }
}
