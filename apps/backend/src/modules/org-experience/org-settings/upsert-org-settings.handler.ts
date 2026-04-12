import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

export type UpsertOrgSettingsCommand = UpsertOrgSettingsDto & { tenantId: string };

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertOrgSettingsCommand) {
    const { tenantId, ...fields } = cmd;
    return this.prisma.organizationSettings.upsert({
      where: { tenantId },
      update: fields,
      create: { tenantId, ...fields },
    });
  }
}
