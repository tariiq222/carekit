import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface CreateConversationDto {
  clientId: string;
  employeeId?: string;
}

@Injectable()
export class CreateConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateConversationDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const isAiChat = !dto.employeeId;

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        status: ConversationStatus.OPEN,
      },
    });
    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        organizationId, // SaaS-02f
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        isAiChat,
      },
    });
  }
}
