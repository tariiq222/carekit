import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetChatbotConfigCommand {
  category?: string;
}

@Injectable()
export class GetChatbotConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  execute(cmd: GetChatbotConfigCommand) {
    return this.prisma.chatbotConfig.findMany({
      where: {
        ...(cmd.category ? { category: cmd.category } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}