import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { BookingType } from '@prisma/client';

export interface DurationOptionInput {
  id?: string;               // present = update, absent = create
  bookingType?: BookingType | null;
  label: string;
  labelAr: string;
  durationMins: number;
  price: number;
  currency?: string;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SetDurationOptionsDto {
  tenantId: string;
  serviceId: string;
  options: DurationOptionInput[];
}

@Injectable()
export class SetDurationOptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: SetDurationOptionsDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId: dto.tenantId },
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
              tenantId: dto.tenantId,
              serviceId: dto.serviceId,
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
      where: { serviceId: dto.serviceId, tenantId: dto.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
