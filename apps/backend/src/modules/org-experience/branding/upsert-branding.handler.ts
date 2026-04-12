import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { UpsertBrandingDto } from './branding.dto';

@Injectable()
export class UpsertBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertBrandingDto) {
    return this.prisma.brandingConfig.upsert({
      where: { tenantId: dto.tenantId },
      create: {
        tenantId: dto.tenantId,
        clinicNameAr: dto.clinicNameAr,
        clinicNameEn: dto.clinicNameEn,
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        primaryColor: dto.primaryColor,
        accentColor: dto.accentColor,
        fontFamily: dto.fontFamily,
        customCss: dto.customCss,
      },
      update: {
        clinicNameAr: dto.clinicNameAr,
        clinicNameEn: dto.clinicNameEn,
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        primaryColor: dto.primaryColor,
        accentColor: dto.accentColor,
        fontFamily: dto.fontFamily,
        customCss: dto.customCss,
      },
    });
  }
}
