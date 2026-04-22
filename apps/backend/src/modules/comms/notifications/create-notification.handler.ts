import { Injectable } from '@nestjs/common';
import { Prisma, NotificationType, RecipientType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface CreateNotificationDto {
  recipientId: string;
  recipientType: RecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CreateNotificationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateNotificationDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.notification.create({
      data: {
        organizationId, // SaaS-02f
        recipientId: dto.recipientId,
        recipientType: dto.recipientType,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
