import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetConversationCommand {
  tenantId: string;
  conversationId: string;
}

@Injectable()
export class GetConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetConversationCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: cmd.conversationId, tenantId: cmd.tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
