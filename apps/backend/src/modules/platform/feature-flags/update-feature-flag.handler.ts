import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface UpdateFeatureFlagCommand {
  key: string;
  enabled: boolean;
}

@Injectable()
export class UpdateFeatureFlagHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: UpdateFeatureFlagCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const flag = await this.prisma.featureFlag.findFirst({
      where: { key: cmd.key, organizationId },
    });
    if (!flag) throw new NotFoundException(`Feature flag "${cmd.key}" not found`);

    return this.prisma.featureFlag.update({
      where: { organizationId_key: { organizationId, key: cmd.key } },
      data: { enabled: cmd.enabled },
    });
  }
}
