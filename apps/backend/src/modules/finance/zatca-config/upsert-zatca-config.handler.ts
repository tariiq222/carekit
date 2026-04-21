import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertZatcaConfigDto } from './upsert-zatca-config.dto';

@Injectable()
export class UpsertZatcaConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertZatcaConfigDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.zatcaConfig.upsert({
      where: { organizationId },
      create: { organizationId, ...dto },
      update: dto,
    });
  }
}
