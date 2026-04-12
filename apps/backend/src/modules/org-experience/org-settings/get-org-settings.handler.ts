import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetOrgSettingsQuery { tenantId: string; }

@Injectable()
export class GetOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetOrgSettingsQuery) {
    return this.prisma.organizationSettings.upsert({
      where: { tenantId: query.tenantId },
      update: {},
      create: { tenantId: query.tenantId },
    });
  }
}
