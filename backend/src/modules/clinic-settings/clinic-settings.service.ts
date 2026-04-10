import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { CLINIC_TIMEZONE_DEFAULT } from '../../config/constants/timezone.js';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto.js';
import type { ClinicSettings } from '@prisma/client';

@Injectable()
export class ClinicSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<ClinicSettings> {
    const cached = await this.cache.get<ClinicSettings>(
      CACHE_KEYS.CLINIC_SETTINGS,
    );
    if (cached) return cached;

    const settings = await this.prisma.clinicSettings.findFirstOrThrow();
    await this.cache.set(
      CACHE_KEYS.CLINIC_SETTINGS,
      settings,
      CACHE_TTL.CLINIC_SETTINGS,
    );
    return settings;
  }

  async update(dto: UpdateClinicSettingsDto): Promise<ClinicSettings> {
    const current = await this.prisma.clinicSettings.findFirstOrThrow();
    const updated = await this.prisma.clinicSettings.update({
      where: { id: current.id },
      data: dto,
    });
    await this.invalidate();
    return updated;
  }

  async getPublic(): Promise<{
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
    socialMedia: unknown;
    cancellationPolicyAr: string | null;
    cancellationPolicyEn: string | null;
  }> {
    const cached = await this.cache.get<
      ReturnType<ClinicSettingsService['getPublic']>
    >(CACHE_KEYS.CLINIC_SETTINGS_PUBLIC);
    if (cached) return cached;

    const s = await this.get();
    const result = {
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      address: s.address,
      socialMedia: s.socialMedia,
      cancellationPolicyAr: s.cancellationPolicyAr,
      cancellationPolicyEn: s.cancellationPolicyEn,
    };
    await this.cache.set(
      CACHE_KEYS.CLINIC_SETTINGS_PUBLIC,
      result,
      CACHE_TTL.CLINIC_SETTINGS,
    );
    return result;
  }

  async getTimezone(): Promise<string> {
    const cached = await this.cache.get<string>(
      CACHE_KEYS.CLINIC_SETTINGS_TIMEZONE,
    );
    if (cached) return cached;

    const settings = await this.get();
    const tz = settings.timezone || CLINIC_TIMEZONE_DEFAULT;
    await this.cache.set(
      CACHE_KEYS.CLINIC_SETTINGS_TIMEZONE,
      tz,
      CACHE_TTL.CLINIC_SETTINGS,
    );
    return tz;
  }

  async getTimeFormat(): Promise<'24h' | '12h'> {
    const settings = await this.get();
    return settings.timeFormat === '12h' ? '12h' : '24h';
  }

  private async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEYS.CLINIC_SETTINGS);
    await this.cache.del(CACHE_KEYS.CLINIC_SETTINGS_PUBLIC);
    await this.cache.del(CACHE_KEYS.CLINIC_SETTINGS_TIMEZONE);
  }
}
