import { Injectable } from '@nestjs/common';
import type { PublicBranding } from '@carekit/shared';
import { PrismaService } from '../../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetPublicBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicBranding> {
    const row = await this.prisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, organizationNameAr: 'منظمتي' },
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
