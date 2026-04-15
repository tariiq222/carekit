import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetBrandingCommand = { tenantId: string };

@Injectable()
export class GetBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GetBrandingCommand) {
    const config = await this.prisma.brandingConfig.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (config) return config;
    return {
      tenantId: dto.tenantId,
      clinicNameAr: '',
      clinicNameEn: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      accentColor: null,
      fontFamily: null,
      customCss: null,
    };
  }
}
