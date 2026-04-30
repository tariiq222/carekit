import { Injectable } from '@nestjs/common';
import type { PublicBranding } from '@deqah/shared';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';

@Injectable()
export class GetPublicBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<PublicBranding> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const row = await this.prisma.brandingConfig.upsert({
      where: { organizationId },
      create: { organizationId, organizationNameAr: 'منظمتي' },
      update: {},
    });

    return {
      organizationNameAr: row.organizationNameAr,
      organizationNameEn: row.organizationNameEn,
      productTagline: row.productTagline,
      logoUrl: row.logoUrl,
      faviconUrl: row.faviconUrl,
      colorPrimary: row.colorPrimary,
      colorPrimaryLight: row.colorPrimaryLight,
      colorPrimaryDark: row.colorPrimaryDark,
      colorAccent: row.colorAccent,
      colorAccentDark: row.colorAccentDark,
      colorBackground: row.colorBackground,
      fontFamily: row.fontFamily,
      fontUrl: row.fontUrl,
      websiteDomain: row.websiteDomain,
      activeWebsiteTheme: row.activeWebsiteTheme,
    };
  }
}
