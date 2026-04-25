import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { GroupSessionMinReachedHandler } from '../group-session-min-reached/group-session-min-reached.handler';
import { CreateBookingDto } from './create-booking.dto';

const VAT_RATE = 0.15;

const roundMoney = (amount: number): number => Number(amount.toFixed(2));

export type CreateBookingCommand = Omit<CreateBookingDto, 'scheduledAt' | 'expiresAt'> & {
  scheduledAt: Date;
  expiresAt?: Date;
};

@Injectable()
export class CreateBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupMinReachedHandler: GroupSessionMinReachedHandler,
  ) {}

  async execute(dto: CreateBookingCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    if (dto.payAtClinic) {
      const settings = await this.settingsHandler.execute({
        branchId: dto.branchId,
      });
      if (!('payAtClinicEnabled' in settings) || !(settings as Record<string, unknown>).payAtClinicEnabled) {
        throw new BadRequestException('Pay at clinic is not enabled for this branch');
      }
    }

    if ((dto.bookingType as string) === 'ONLINE') {
      // SaaS-02g: Integration.provider is now composite-unique per org; findFirst + Proxy auto-scopes.
      const zoomIntegration = await this.prisma.integration.findFirst({
        where: { provider: 'zoom' },
      });
      if (!zoomIntegration || !zoomIntegration.isActive) {
        throw new BadRequestException('Zoom integration must be configured for online bookings');
      }
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

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

    // Resolve price + duration via PriceResolverService (3-tier: employee override → duration option → service base).
    const resolved = await this.priceResolver.resolve({
      serviceId: dto.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: dto.durationOptionId ?? null,
      bookingType: dto.bookingType ?? null,
    });

    const durationMins = resolved.durationMins;
    const price = resolved.price;
    const currency = dto.currency ?? resolved.currency;

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    let discountedPrice: number | null = null;

    if (dto.couponCode) {
      // SaaS-02e: Coupon.code is now composite-unique per (organizationId, code).
      // The Proxy auto-scopes organizationId from CLS — this is an authenticated
      // flow (dashboard/client), so CLS is always set.
      const coupon = await this.prisma.coupon.findFirst({
        where: { code: dto.couponCode },
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

    // Resolve group-session settings from the service
    const serviceRecord = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
      select: { minParticipants: true, maxParticipants: true, reserveWithoutPayment: true },
    });
    const isGroupService =
      !!serviceRecord && serviceRecord.maxParticipants > 1 && serviceRecord.reserveWithoutPayment;

    // For group services, use PENDING_GROUP_FILL until minParticipants is reached.
    const initialStatus = isGroupService ? 'PENDING_GROUP_FILL' : 'PENDING';

    // Serialize the conflict check + insert so two concurrent requests for the
    // same slot cannot both pass the overlap check.
    const booking = await this.prisma.$transaction(
      async (tx) => {
        if (!isGroupService) {
          // Individual bookings: hard overlap check
          const conflict = await tx.booking.findFirst({
            where: {
              organizationId,
              employeeId: dto.employeeId,
              status: { in: ['PENDING', 'CONFIRMED'] },
              scheduledAt: { lt: endsAt },
              endsAt: { gt: scheduledAt },
            },
            select: { id: true },
          });
          if (conflict) {
            throw new ConflictException('Employee already has a booking in this time slot');
          }
        } else {
          // Group bookings: check capacity
          const slotCount = await tx.booking.count({
            where: {
              organizationId,
              serviceId: dto.serviceId,
              employeeId: dto.employeeId,
              scheduledAt,
              status: { in: ['PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED'] },
            },
          });
          if (slotCount >= serviceRecord!.maxParticipants) {
            throw new ConflictException('This group session is full');
          }
        }

        const booking = await tx.booking.create({
          data: {
            organizationId,
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
            bookingType: isGroupService ? 'GROUP' : (dto.bookingType ?? 'INDIVIDUAL'),
            notes: dto.notes,
            expiresAt: dto.expiresAt,
            groupSessionId: dto.groupSessionId,
            payAtClinic: dto.payAtClinic ?? false,
            couponCode: dto.couponCode ?? null,
            discountedPrice: discountedPrice,
            status: initialStatus,
          },
        });

        let invoice: { id: string } | null = null;
        if (!dto.payAtClinic && !isGroupService) {
          const subtotal = discountedPrice ?? price;
          const vatAmt = roundMoney(subtotal * VAT_RATE);
          const total = roundMoney(subtotal + vatAmt);

          invoice = await tx.invoice.create({
            data: {
              organizationId,
              branchId: booking.branchId,
              clientId: booking.clientId,
              employeeId: booking.employeeId,
              bookingId: booking.id,
              subtotal,
              vatRate: VAT_RATE,
              vatAmt,
              total,
              currency: booking.currency,
              status: 'ISSUED',
              issuedAt: new Date(),
            },
            select: { id: true },
          });
        }

        return { ...booking, invoiceId: invoice?.id ?? null };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // After insert: check if minParticipants is now reached for this slot
    if (isGroupService) {
      const filledCount = await this.prisma.booking.count({
        where: {
          serviceId: dto.serviceId,
          employeeId: dto.employeeId,
          scheduledAt,
          status: { in: ['PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED'] },
        },
      });
      if (filledCount >= serviceRecord!.minParticipants) {
        // Fire-and-forget — don't fail the booking if notification fails
        this.groupMinReachedHandler.execute({
          serviceId: dto.serviceId,
          employeeId: dto.employeeId,
          scheduledAt,
        }).catch(() => { /* logged by eventBus */ });
      }
    }

    return booking;
  }
}
