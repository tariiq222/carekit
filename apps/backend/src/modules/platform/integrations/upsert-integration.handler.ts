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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { tenantId: cmd.tenantId, provider: cmd.provider, config: cmd.config as any, isActive: cmd.isActive ?? true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { config: cmd.config as any, isActive: cmd.isActive ?? true },
    });
  }
}
