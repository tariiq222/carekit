import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateWhitelabelDto } from './dto/update-config.dto.js';
import type { WhiteLabelConfig } from '@prisma/client';

@Injectable()
export class WhitelabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<WhiteLabelConfig> {
    const cached = await this.cache.get<WhiteLabelConfig>(
      CACHE_KEYS.WHITELABEL,
    );
    if (cached) return cached;

    const config = await this.prisma.whiteLabelConfig.findFirstOrThrow();
    await this.cache.set(
      CACHE_KEYS.WHITELABEL,
      config,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    return config;
  }

  async getPublicBranding(): Promise<{
    systemName: string;
    systemNameAr: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  }> {
    const cached = await this.cache.get<
      Awaited<ReturnType<WhitelabelService['getPublicBranding']>>
    >(CACHE_KEYS.WHITELABEL_PUBLIC);
    if (cached) return cached;

    const config = await this.get();
    const result = {
      systemName: config.systemName,
      systemNameAr: config.systemNameAr,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
    };
    await this.cache.set(
      CACHE_KEYS.WHITELABEL_PUBLIC,
      result,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    return result;
  }

  async update(dto: UpdateWhitelabelDto): Promise<WhiteLabelConfig> {
    const current = await this.prisma.whiteLabelConfig.findFirstOrThrow();

    if (!current.clinicCanEdit) {
      throw new ForbiddenException(
        'Whitelabel config is locked. Contact CareKit support.',
      );
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
