import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListRatingsDto } from './list-ratings.dto';

export type ListRatingsCommand = ListRatingsDto & { tenantId: string };

@Injectable()
export class ListRatingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListRatingsCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.employeeId && { employeeId: dto.employeeId }),
      ...(dto.clientId && { clientId: dto.clientId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.rating.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
