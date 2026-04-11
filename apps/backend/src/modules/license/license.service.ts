import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateLicenseDto } from './dto/update-license.dto.js';
import type { LicenseConfig } from '@prisma/client';

const FLAG_TO_LICENSE: Record<string, keyof LicenseConfig> = {
  coupons: 'hasCoupons',
  intake_forms: 'hasIntakeForms',
  chatbot: 'hasChatbot',
  ratings: 'hasRatings',
  multi_branch: 'hasMultiBranch',
  reports: 'hasReports',
  recurring: 'hasRecurring',
  walk_in: 'hasWalkIn',
  waitlist: 'hasWaitlist',
  zoom: 'hasZoom',
  zatca: 'hasZatca',
  departments: 'hasDepartments',
  groups: 'hasGroups',
};

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<LicenseConfig> {
    const cached = await this.cache.get<LicenseConfig>(CACHE_KEYS.LICENSE);
    if (cached) return cached;

    const license = await this.prisma.licenseConfig.findFirstOrThrow();
    await this.cache.set(CACHE_KEYS.LICENSE, license, CACHE_TTL.LICENSE_CONFIG);
    return license;
  }

  async update(dto: UpdateLicenseDto): Promise<LicenseConfig> {
    const current = await this.prisma.licenseConfig.findFirstOrThrow();
    const updated = await this.prisma.licenseConfig.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async isFeatureLicensed(flagKey: string): Promise<boolean> {
    const field = FLAG_TO_LICENSE[flagKey];
    if (!field) return true;
    const license = await this.get();
    return license[field] as boolean;
  }

  async getFeaturesWithStatus(): Promise<
    Array<{
      key: string;
      licensed: boolean;
      enabled: boolean;
      nameAr: string;
      nameEn: string;
    }>
  > {
    const [license, flags] = await Promise.all([
      this.get(),
      this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
    ]);

    return flags.map((flag) => {
      const field = FLAG_TO_LICENSE[flag.key];
      const licensed = field ? (license[field] as boolean) : true;
      return {
        key: flag.key,
        licensed,
        enabled: licensed && flag.enabled,
        nameAr: flag.nameAr,
        nameEn: flag.nameEn,
      };
    });
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.LICENSE);
    await this.cache.del(CACHE_KEYS.LICENSE_FEATURES);
    // Feature flags map is derived from license status — bust it too
    // so getMap() recomputes with the updated license values.
    await this.cache.del(CACHE_KEYS.FEATURE_FLAGS_MAP);
  }
}
