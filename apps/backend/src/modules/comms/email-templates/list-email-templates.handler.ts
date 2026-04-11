import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListEmailTemplatesDto {
  tenantId: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListEmailTemplatesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListEmailTemplatesDto) {
    const where = { tenantId: dto.tenantId };
    const [data, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);
    return {
      data,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
}
