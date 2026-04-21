import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { SetDurationOptionsDto } from './set-duration-options.dto';

export type SetDurationOptionsCommand = SetDurationOptionsDto & { serviceId: string };

@Injectable()
export class SetDurationOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: SetDurationOptionsCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, organizationId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const upserts = dto.options.map((opt) =>
      opt.id
        ? this.prisma.serviceDurationOption.update({
            where: { id: opt.id },
            data: {
              bookingType: opt.bookingType ?? null,
              label: opt.label,
              labelAr: opt.labelAr,
              durationMins: opt.durationMins,
              price: opt.price,
              currency: opt.currency ?? 'SAR',
              isDefault: opt.isDefault ?? false,
              sortOrder: opt.sortOrder ?? 0,
              ...(opt.isActive !== undefined && { isActive: opt.isActive }),
            },
          })
        : this.prisma.serviceDurationOption.create({
            data: {
              serviceId: dto.serviceId,
              organizationId,
              bookingType: opt.bookingType ?? null,
              label: opt.label,
              labelAr: opt.labelAr,
              durationMins: opt.durationMins,
              price: opt.price,
              currency: opt.currency ?? 'SAR',
              isDefault: opt.isDefault ?? false,
              sortOrder: opt.sortOrder ?? 0,
            },
          }),
    );

    await this.prisma.$transaction(upserts);

    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId: dto.serviceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
