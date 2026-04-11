import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertIntegrationCommand {
  tenantId: string;
  provider: string;
  config: Record<string, unknown>;
  isActive?: boolean;
}

@Injectable()
export class UpsertIntegrationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertIntegrationCommand) {
    return this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId: cmd.tenantId, provider: cmd.provider } },
      create: { tenantId: cmd.tenantId, provider: cmd.provider, config: cmd.config, isActive: cmd.isActive ?? true },
      update: { config: cmd.config, isActive: cmd.isActive ?? true },
    });
  }
}
