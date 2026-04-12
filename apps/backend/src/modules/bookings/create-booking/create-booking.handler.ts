import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../organization/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import type { CreateBookingDto } from './create-booking.dto';

@Injectable()
export class CreateBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(dto: CreateBookingDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    if (dto.payAtClinic) {
      const settings = await this.settingsHandler.execute({
        tenantId: dto.tenantId,
        branchId: dto.branchId,
      });
      if (!('payAtClinicEnabled' in settings) || !(settings as any).payAtClinicEnabled) {
        throw new BadRequestException('Pay at clinic is not enabled for this branch');
      }
    }

    if ((dto.bookingType as string) === 'ONLINE') {
      const zoomIntegration = await this.prisma.integration.findUnique({
        where: { tenantId_provider: { tenantId: dto.tenantId, provider: 'zoom' } },
      });
      if (!zoomIntegration || !zoomIntegration.isActive) {
        throw new BadRequestException('Zoom integration must be configured for online bookings');
      }
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

    let discountedPrice: number | null = null;

    if (dto.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { tenantId_code: { tenantId: dto.tenantId, code: dto.couponCode } },
      });
      if (!coupon || !coupon.isActive) throw new BadRequestException(`Coupon ${dto.couponCode} not found`);
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BadRequestException(`Coupon ${dto.couponCode} has expired`);
      }
      if (coupon.minOrderAmt !== null && Number(price) < Number(coupon.minOrderAmt)) {
        throw new BadRequestException(`Order total does not meet minimum for coupon`);
      }
      const discount = coupon.discountType === 'PERCENTAGE'
        ? Number(price) * Number(coupon.discountValue) / 100
        : Math.min(Number(coupon.discountValue), Number(price));
      discountedPrice = parseFloat((Number(price) - discount).toFixed(2));
    }

    if (dto.giftCardCode) {
      const card = await this.prisma.giftCard.findUnique({
        where: { tenantId_code: { tenantId: dto.tenantId, code: dto.giftCardCode } },
      });
      if (!card || !card.isActive) throw new BadRequestException(`Gift card ${dto.giftCardCode} not found`);
      if (Number(card.balance) <= 0) throw new BadRequestException(`Gift card has no balance`);
      const basePrice = discountedPrice ?? Number(price);
      const deduction = Math.min(Number(card.balance), basePrice);
      discountedPrice = parseFloat((basePrice - deduction).toFixed(2));
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
        payAtClinic: dto.payAtClinic ?? false,
        couponCode: dto.couponCode ?? null,
        giftCardCode: dto.giftCardCode ?? null,
        discountedPrice: discountedPrice,
        status: 'PENDING',
      },
    });
  }
}
