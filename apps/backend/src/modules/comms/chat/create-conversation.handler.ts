import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateConversationDto {
  tenantId: string;
  clientId: string;
  employeeId?: string;
}

@Injectable()
export class CreateConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateConversationDto) {
    const isAiChat = !dto.employeeId;

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        tenantId: dto.tenantId,
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        status: ConversationStatus.OPEN,
      },
    });
    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        tenantId: dto.tenantId,
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        isAiChat,
      },
    });
  }
}
