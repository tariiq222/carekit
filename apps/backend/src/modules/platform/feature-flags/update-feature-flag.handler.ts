import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateFeatureFlagCommand {
  tenantId: string;
  key: string;
  enabled: boolean;
}

@Injectable()
export class UpdateFeatureFlagHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateFeatureFlagCommand) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { tenantId_key: { tenantId: cmd.tenantId, key: cmd.key } },
    });
    if (!flag) throw new NotFoundException(`Feature flag "${cmd.key}" not found`);

    return this.prisma.featureFlag.update({
      where: { tenantId_key: { tenantId: cmd.tenantId, key: cmd.key } },
      data: { enabled: cmd.enabled },
    });
  }
}