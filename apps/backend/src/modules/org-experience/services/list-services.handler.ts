import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListServicesDto } from './list-services.dto';

export type ListServicesCommand = ListServicesDto & { tenantId: string };

@Injectable()
export class ListServicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListServicesCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      archivedAt: null,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
