import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListConversationsDto } from './list-conversations.dto';

export type ListConversationsCommand = Omit<ListConversationsDto, 'page' | 'limit'> & {
  tenantId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListConversationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListConversationsCommand) {
    const where = {
      tenantId: cmd.tenantId,
      ...(cmd.clientId ? { clientId: cmd.clientId } : {}),
      ...(cmd.employeeId ? { employeeId: cmd.employeeId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: cmd.page,
        limit: cmd.limit,
        totalPages: Math.ceil(total / cmd.limit),
      },
    };
  }
}
