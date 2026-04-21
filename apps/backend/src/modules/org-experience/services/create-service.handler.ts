import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateServiceDto } from './create-service.dto';

export type CreateServiceCommand = CreateServiceDto;

@Injectable()
export class CreateServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateServiceCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    this.validateBusinessRules(dto);

    const existing = await this.prisma.service.findFirst({
      where: { nameAr: dto.nameAr, archivedAt: null, organizationId },
    });
    if (existing) throw new ConflictException('Service with this Arabic name already exists');

    return this.prisma.service.create({
      data: {
        organizationId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        durationMins: dto.durationMins,
        price: dto.price,
        currency: dto.currency ?? 'SAR',
        imageUrl: dto.imageUrl,
        categoryId: dto.categoryId,
        // العرض/الإخفاء
        isActive: dto.isActive ?? true,
        isHidden: dto.isHidden ?? false,
        hidePriceOnBooking: dto.hidePriceOnBooking ?? false,
        hideDurationOnBooking: dto.hideDurationOnBooking ?? false,
        // الهوية البصرية
        iconName: dto.iconName,
        iconBgColor: dto.iconBgColor,
        // قواعد الجدولة
        bufferMinutes: dto.bufferMinutes ?? 0,
        minLeadMinutes: dto.minLeadMinutes,
        maxAdvanceDays: dto.maxAdvanceDays,
        // العربون
        depositEnabled: dto.depositEnabled ?? false,
        depositAmount: dto.depositAmount,
        // التكرار
        allowRecurring: dto.allowRecurring ?? false,
        allowedRecurringPatterns: dto.allowedRecurringPatterns ?? [],
        maxRecurrences: dto.maxRecurrences,
        // الجلسات الجماعية
        minParticipants: dto.minParticipants ?? 1,
        maxParticipants: dto.maxParticipants ?? 1,
        reserveWithoutPayment: dto.reserveWithoutPayment ?? false,
      },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  private validateBusinessRules(dto: CreateServiceCommand): void {
    if (
      dto.depositEnabled &&
      dto.depositAmount !== undefined &&
      dto.depositAmount > dto.price
    ) {
      throw new BadRequestException('depositAmount must not exceed the service price');
    }

    const min = dto.minParticipants ?? 1;
    const max = dto.maxParticipants ?? 1;
    if (min > max) {
      throw new BadRequestException('minParticipants must not exceed maxParticipants');
    }

    if (dto.reserveWithoutPayment && max <= 1) {
      throw new BadRequestException('reserveWithoutPayment requires maxParticipants > 1');
    }
  }
}
