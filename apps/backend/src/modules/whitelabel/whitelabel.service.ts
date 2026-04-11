import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateWhitelabelDto } from './dto/update-config.dto.js';
import type { WhiteLabelConfig } from '@prisma/client';

export type PublicBranding = Pick<
  WhiteLabelConfig,
  | 'systemName'
  | 'systemNameAr'
  | 'productTagline'
  | 'logoUrl'
  | 'faviconUrl'
  | 'colorPrimary'
  | 'colorPrimaryLight'
  | 'colorPrimaryDark'
  | 'colorAccent'
  | 'colorAccentDark'
  | 'colorBackground'
  | 'fontFamily'
  | 'fontUrl'
>;

@Injectable()
export class WhitelabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<WhiteLabelConfig> {
    const cached = await this.cache.get<WhiteLabelConfig>(CACHE_KEYS.WHITELABEL);
    if (cached) return cached;

    const config = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    await this.cache.set(CACHE_KEYS.WHITELABEL, config, CACHE_TTL.WHITELABEL_CONFIG);
    return config;
  }

  async getPublicBranding(): Promise<PublicBranding> {
    const cached = await this.cache.get<PublicBranding>(CACHE_KEYS.WHITELABEL_PUBLIC);
    if (cached) return cached;

    const config = await this.get();
    const result: PublicBranding = {
      systemName:        config.systemName,
      systemNameAr:      config.systemNameAr,
      productTagline:    config.productTagline,
      logoUrl:           config.logoUrl,
      faviconUrl:        config.faviconUrl,
      colorPrimary:      config.colorPrimary,
      colorPrimaryLight: config.colorPrimaryLight,
      colorPrimaryDark:  config.colorPrimaryDark,
      colorAccent:       config.colorAccent,
      colorAccentDark:   config.colorAccentDark,
      colorBackground:   config.colorBackground,
      fontFamily:        config.fontFamily,
      fontUrl:           config.fontUrl,
    };
    await this.cache.set(CACHE_KEYS.WHITELABEL_PUBLIC, result, CACHE_TTL.WHITELABEL_CONFIG);
    return result;
  }

  async update(dto: UpdateWhitelabelDto): Promise<WhiteLabelConfig> {
    const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    if (!current.clinicCanEdit) {
      throw new ForbiddenException('Whitelabel config is locked. Contact CareKit support.');
    }
    const updated = await this.prisma.whiteLabelConfig.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async adminUpdate(dto: UpdateWhitelabelDto): Promise<WhiteLabelConfig> {
    const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    const updated = await this.prisma.whiteLabelConfig.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async getSystemName(): Promise<string> {
    const config = await this.get();
    return config.systemName;
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.WHITELABEL);
    await this.cache.del(CACHE_KEYS.WHITELABEL_PUBLIC);
  }
}
