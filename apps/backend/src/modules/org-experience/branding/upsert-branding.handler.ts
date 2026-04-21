import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertBrandingDto } from './upsert-branding.dto';

@Injectable()
export class UpsertBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertBrandingDto) {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.brandingConfig.upsert({
      where: { organizationId },
      create: { organizationId, ...dto, organizationNameAr: dto.organizationNameAr ?? 'منظمتي' },
      update: dto,
    });
  }
}
