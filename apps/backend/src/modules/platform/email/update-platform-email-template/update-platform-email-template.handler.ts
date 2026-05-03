import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UpdatePlatformEmailTemplateDto } from './update-platform-email-template.dto';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';

type TemplateClient = {
  platformEmailTemplate: {
    update: (args: {
      where: { slug: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  superAdminActionLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<void>;
  };
};

export interface UpdatePlatformEmailTemplateCommand {
  slug: string;
  dto: UpdatePlatformEmailTemplateDto;
  superAdminUserId: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class UpdatePlatformEmailTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly getHandler: GetPlatformEmailTemplateHandler,
  ) {}

  async execute(cmd: UpdatePlatformEmailTemplateCommand): Promise<unknown> {
    const template = await this.getHandler.execute(cmd.slug);

    // Locked templates: only isActive may be changed
    if (template.isLocked) {
      const hasLockedFieldChange =
        cmd.dto.name !== undefined ||
        cmd.dto.subjectAr !== undefined ||
        cmd.dto.subjectEn !== undefined ||
        cmd.dto.htmlBody !== undefined;
      if (hasLockedFieldChange) {
        throw new ForbiddenException('template_is_locked');
      }
    }

    const client = this.prisma as unknown as TemplateClient;

    const updateData: Record<string, unknown> = {
      version: { increment: 1 },
      updatedById: cmd.superAdminUserId,
    };
    if (cmd.dto.name !== undefined) updateData.name = cmd.dto.name;
    if (cmd.dto.subjectAr !== undefined) updateData.subjectAr = cmd.dto.subjectAr;
    if (cmd.dto.subjectEn !== undefined) updateData.subjectEn = cmd.dto.subjectEn;
    if (cmd.dto.htmlBody !== undefined) updateData.htmlBody = cmd.dto.htmlBody;
    if (cmd.dto.isActive !== undefined) updateData.isActive = cmd.dto.isActive;

    const updated = await client.platformEmailTemplate.update({
      where: { slug: cmd.slug },
      data: updateData,
    });

    await client.superAdminActionLog.create({
      data: {
        superAdminUserId: cmd.superAdminUserId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actionType: 'PLATFORM_SETTING_UPDATED' as any as SuperAdminActionType,
        organizationId: null,
        reason: `Updated email template: ${cmd.slug}`,
        metadata: { slug: cmd.slug, fields: Object.keys(cmd.dto) },
        ipAddress: cmd.ipAddress,
        userAgent: cmd.userAgent,
      },
    });

    return updated;
  }
}
