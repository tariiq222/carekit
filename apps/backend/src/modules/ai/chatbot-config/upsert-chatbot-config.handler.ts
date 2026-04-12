import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertChatbotConfigCommand {
  tenantId: string;
  configs: { key: string; value: unknown; category: string }[];
}

@Injectable()
export class UpsertChatbotConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  execute(cmd: UpsertChatbotConfigCommand) {
    return this.prisma.$transaction(
      cmd.configs.map((entry) =>
        this.prisma.chatbotConfig.upsert({
          where: { tenantId_key: { tenantId: cmd.tenantId, key: entry.key } },
          create: {
            tenantId: cmd.tenantId,
            key: entry.key,
            value: entry.value as Prisma.InputJsonValue,
            category: entry.category,
          },
          update: {
            value: entry.value as Prisma.InputJsonValue,
            category: entry.category,
          },
        }),
      ),
    );
  }
}
