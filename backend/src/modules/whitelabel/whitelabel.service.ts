import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { WhiteLabelConfig } from '@prisma/client';
import { ClinicSettingsService } from '../clinic/clinic-settings.service.js';
import { CLINIC_TIMEZONE_DEFAULT } from '../../config/constants/timezone.js';

@Injectable()
export class WhitelabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly clinicSettingsService: ClinicSettingsService,
  ) {}

  // Keys whose values must NEVER be sent to the frontend (masked with ***)
  private static readonly SENSITIVE_KEYS = [
    'moyasar_secret_key',
    'bank_iban',
    'bank_account_holder',
  ];

  private static maskSensitive(key: string, value: string): string {
    return WhitelabelService.SENSITIVE_KEYS.includes(key) ? '***' : value;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PUBLIC BRANDING — No auth required (widget + mobile pre-login)
  //  Returns branding colors + payment flags + widget settings
  // ═══════════════════════════════════════════════════════════════

  private static readonly PUBLIC_KEYS = [
    'system_name', 'system_name_ar', 'logo_url', 'favicon_url',
    'primary_color', 'secondary_color', 'contact_phone', 'contact_email',
  ];

  async getPublicBranding(): Promise<Record<string, string | boolean | number | null>> {
    const cached = await this.cache.get<Record<string, string | boolean | number | null>>(
      CACHE_KEYS.WHITELABEL_BRANDING,
    );
    if (cached) return cached;

    // Fetch branding keys
    const configs = await this.prisma.whiteLabelConfig.findMany({
      where: { key: { in: WhitelabelService.PUBLIC_KEYS } },
      select: { key: true, value: true },
    });
    const brandingMap = configs.reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = c.value;
      return acc;
    }, {});

    // Fetch payment + widget settings from BookingSettings (global row)
    const bookingSettings = await this.prisma.bookingSettings.findFirst({
      where: { branchId: null },
      select: {
        paymentMoyasarEnabled: true,
        paymentAtClinicEnabled: true,
        widgetShowPrice: true,
        widgetAnyPractitioner: true,
        widgetRedirectUrl: true,
        maxAdvanceBookingDays: true,
      },
    });

    const fullResult: Record<string, string | boolean | number | null> = {
      ...brandingMap,
      // Payment flags (kept as strings for backward compat with existing widget code)
      payment_moyasar_enabled: String(bookingSettings?.paymentMoyasarEnabled ?? false),
      payment_at_clinic_enabled: String(bookingSettings?.paymentAtClinicEnabled ?? true),
      // Widget settings (typed booleans — widget reads them directly)
      widget_show_price: bookingSettings?.widgetShowPrice ?? true,
      widget_any_practitioner: bookingSettings?.widgetAnyPractitioner ?? false,
      widget_redirect_url: bookingSettings?.widgetRedirectUrl ?? null,
      widget_max_advance_days: bookingSettings?.maxAdvanceBookingDays ?? 0,
    };

    await this.cache.set(
      CACHE_KEYS.WHITELABEL_BRANDING,
      fullResult,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    return fullResult;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET ALL — Return all configs ordered by key
  // ═══════════════════════════════════════════════════════════════

  async getConfig(): Promise<WhiteLabelConfig[]> {
    const cached = await this.cache.get<WhiteLabelConfig[]>(
      CACHE_KEYS.WHITELABEL_CONFIG,
    );
    if (cached) return cached;

    const configs = await this.prisma.whiteLabelConfig.findMany({
      orderBy: { key: 'asc' },
    });

    await this.cache.set(
      CACHE_KEYS.WHITELABEL_CONFIG,
      configs,
      CACHE_TTL.WHITELABEL_CONFIG,
    );
    // Mask sensitive values before returning to callers
    return configs.map((c) => ({
      ...c,
      value: WhitelabelService.maskSensitive(c.key, c.value),
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET MAP — Return configs as { key: value } object
  // ═══════════════════════════════════════════════════════════════

  async getConfigMap(): Promise<Record<string, string>> {
    const configs = await this.getConfig();

    return configs.reduce<Record<string, string>>((acc, config) => {
      acc[config.key] = config.value; // already masked by getConfig()
      return acc;
    }, {});
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET TIMEZONE — Returns clinic timezone from config, with fallback
  // ═══════════════════════════════════════════════════════════════

  async getTimezone(): Promise<string> {
    const cached = await this.cache.get<string>(CACHE_KEYS.WHITELABEL_TIMEZONE);
    if (cached) return cached;

    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key: 'timezone' },
      select: { value: true },
    });

    const tz = config?.value || CLINIC_TIMEZONE_DEFAULT;
    await this.cache.set(CACHE_KEYS.WHITELABEL_TIMEZONE, tz, CACHE_TTL.WHITELABEL_CONFIG);
    return tz;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET TIME FORMAT — Returns clinic time format (24h/12h)
  // ═══════════════════════════════════════════════════════════════

  async getTimeFormat(): Promise<'24h' | '12h'> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key: 'time_format' },
      select: { value: true },
    });
    return (config?.value === '12h' ? '12h' : '24h');
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPSERT — Create or update each config item
  // ═══════════════════════════════════════════════════════════════

  async updateConfig(dto: UpdateConfigDto): Promise<WhiteLabelConfig[]> {
    // Skip items where the frontend echoed back the masked placeholder
    const items = dto.configs.filter((item) => item.value !== '***');

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.whiteLabelConfig.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            type: item.type ?? 'string',
            description: item.description,
          },
          update: {
            value: item.value,
            ...(item.type !== undefined && { type: item.type }),
            ...(item.description !== undefined && { description: item.description }),
          },
        }),
      ),
    );

    await this.invalidateCache();
    return this.getConfig(); // returns masked values
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET BY KEY — Return single config item
  // ═══════════════════════════════════════════════════════════════

  async getConfigByKey(key: string): Promise<WhiteLabelConfig> {
    const cacheKey = `${CACHE_KEYS.WHITELABEL_KEY_PREFIX}${key}`;

    const cached = await this.cache.get<WhiteLabelConfig>(cacheKey);
    if (cached) return cached;

    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    await this.cache.set(cacheKey, config, CACHE_TTL.WHITELABEL_CONFIG);
    return config;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE — Delete config by key
  // ═══════════════════════════════════════════════════════════════

  async deleteConfig(key: string): Promise<WhiteLabelConfig> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    const deleted = await this.prisma.whiteLabelConfig.delete({
      where: { key },
    });

    await this.invalidateCache();
    return deleted;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════

  async invalidateAll(): Promise<void> {
    await this.cache.delPattern(CACHE_KEYS.WHITELABEL_ALL_PATTERN);
  }

  private invalidateCache(): Promise<void> {
    return this.invalidateAll();
  }
}
