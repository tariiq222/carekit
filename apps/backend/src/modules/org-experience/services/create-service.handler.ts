import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateServiceDto } from './create-service.dto';

export type CreateServiceCommand = CreateServiceDto & { tenantId: string };

@Injectable()
export class CreateServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateServiceCommand) {
    const existing = await this.prisma.service.findFirst({
      where: { tenantId: dto.tenantId, nameAr: dto.nameAr, archivedAt: null },
    });
    if (existing) throw new ConflictException('Service with this Arabic name already exists');

    return this.prisma.service.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        durationMins: dto.durationMins,
        price: dto.price,
        currency: dto.currency ?? 'SAR',
        imageUrl: dto.imageUrl,
      },
    });
  }
}
