import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateServiceDto } from './update-service.dto';

export type UpdateServiceCommand = UpdateServiceDto & { tenantId: string; serviceId: string };

@Injectable()
export class UpdateServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateServiceCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId: dto.tenantId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: dto.serviceId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        durationMins: dto.durationMins,
        price: dto.price,
        currency: dto.currency,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive,
      },
    });
  }
}
