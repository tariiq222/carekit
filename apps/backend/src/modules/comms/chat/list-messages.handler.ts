import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListMessagesDto {
  tenantId: string;
  conversationId: string;
  /** Cursor = id of the oldest message already loaded by the client. */
  cursor?: string;
  limit: number;
}

@Injectable()
export class ListMessagesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListMessagesDto) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: dto.conversationId, tenantId: dto.tenantId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    // Cursor-based pagination: fetch `limit + 1` to detect if more pages exist.
    // Ordered newest-first so mobile can load older messages as user scrolls up.
    const take = dto.limit + 1;
    const messages = await this.prisma.commsChatMessage.findMany({
      where: {
        tenantId: dto.tenantId,
        conversationId: dto.conversationId,
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(dto.cursor
        ? { cursor: { id: dto.cursor }, skip: 1 } // skip the cursor itself
        : {}),
    });

    const hasMore = messages.length > dto.limit;
    const data = hasMore ? messages.slice(0, dto.limit) : messages;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      meta: {
        limit: dto.limit,
        nextCursor,
        hasMore,
      },
    };
  }
}
