import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { mapBookingRow, type BookingRelations } from '../booking-row.mapper';

export interface GetBookingQuery {
  bookingId: string;
}

@Injectable()
export class GetBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetBookingQuery) {
    const organizationId = this.tenant.requireOrganizationId();
    const booking = await this.prisma.booking.findFirst({
      where: { id: query.bookingId, organizationId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${query.bookingId} not found`);
    }

    const [client, employee, service] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: booking.clientId, organizationId } }),
      this.prisma.employee.findFirst({ where: { id: booking.employeeId, organizationId } }),
      this.prisma.service.findFirst({ where: { id: booking.serviceId, organizationId } }),
    ]);

    const relations: BookingRelations = {
      clientsById: new Map(client ? [[client.id, client]] : []),
      employeesById: new Map(employee ? [[employee.id, employee]] : []),
      servicesById: new Map(service ? [[service.id, service]] : []),
    };

    return mapBookingRow(booking, relations);
  }
}
