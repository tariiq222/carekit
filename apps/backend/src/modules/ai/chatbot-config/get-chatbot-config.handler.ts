import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetChatbotConfigCommand {
  tenantId: string;
  category?: string;
}

@Injectable()
export class GetChatbotConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  execute(cmd: GetChatbotConfigCommand) {
    return this.prisma.chatbotConfig.findMany({
      where: {
        tenantId: cmd.tenantId,
        ...(cmd.category ? { category: cmd.category } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
