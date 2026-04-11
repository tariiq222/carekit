import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListConversationsDto {
  tenantId: string;
  clientId?: string;
  employeeId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListConversationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListConversationsDto) {
    const where = {
      tenantId: dto.tenantId,
      ...(dto.clientId ? { clientId: dto.clientId } : {}),
      ...(dto.employeeId ? { employeeId: dto.employeeId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.chatConversation.count({ where }),
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
