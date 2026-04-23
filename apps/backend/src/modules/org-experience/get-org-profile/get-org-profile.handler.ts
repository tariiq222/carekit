import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface OrgProfileDto {
  nameAr: string;
  nameEn: string | null;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
}

@Injectable()
export class GetOrgProfileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<OrgProfileDto> {
    const organizationId = this.tenant.requireOrganizationId();

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { nameAr: true, nameEn: true, slug: true },
    });

    const branding = await this.prisma.brandingConfig.upsert({
      where: { organizationId },
      create: { organizationId, organizationNameAr: org.nameAr },
      update: {},
      select: { productTagline: true, logoUrl: true },
    });

    return {
      nameAr: org.nameAr,
      nameEn: org.nameEn,
      slug: org.slug,
      tagline: branding.productTagline,
      logoUrl: branding.logoUrl,
    };
  }
}