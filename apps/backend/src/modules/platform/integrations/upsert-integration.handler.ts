import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { asPrismaJson } from '../../../common/prisma-json';
import { TenantContextService } from '../../../common/tenant';
import { UpsertIntegrationDto } from './upsert-integration.dto';

export type UpsertIntegrationCommand = UpsertIntegrationDto;

@Injectable()
export class UpsertIntegrationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: UpsertIntegrationCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.integration.upsert({
      where: { organizationId_provider: { organizationId, provider: cmd.provider } },
      create: {
        organizationId,
        provider: cmd.provider,
        config: asPrismaJson(cmd.config),
        isActive: cmd.isActive ?? true,
      },
      update: { config: asPrismaJson(cmd.config), isActive: cmd.isActive ?? true },
    });
  }
}
