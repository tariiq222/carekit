import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { LicenseInfo, TIER_FEATURES } from './license.types';

const CACHE_TTL_MS = 60 * 60 * 1000;
const BASIC: LicenseInfo = {
  tier: 'Basic',
  features: TIER_FEATURES['Basic'],
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
};

@Injectable()
export class ValidateLicenseService {
  private readonly logger = new Logger(ValidateLicenseService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getActiveLicense(tenantId: string): Promise<LicenseInfo> {
    const cached = await this.prisma.licenseCache.findUnique({ where: { tenantId } });
    const serverUrl = this.config.get<string>('LICENSE_SERVER_URL');

    if (cached) {
      const stale = Date.now() - cached.lastCheckedAt.getTime() > CACHE_TTL_MS;
      if (!stale || !serverUrl) {
        return { tier: cached.tier, features: cached.features as string[], expiresAt: cached.expiresAt };
      }
    }

    if (!serverUrl) {
      this.logger.warn(`No LICENSE_SERVER_URL — using Basic for ${tenantId}`);
      await this.upsertCache(tenantId, BASIC);
      return BASIC;
    }

    try {
      const licenseKey = this.config.get<string>('LICENSE_KEY') ?? '';
      const res = await fetch(`${serverUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, licenseKey }),
      });
      if (!res.ok) throw new Error(`License server ${res.status}`);
      const data = (await res.json()) as { tier: string; features: string[]; expiresAt: string };
      const info: LicenseInfo = { tier: data.tier, features: data.features, expiresAt: new Date(data.expiresAt) };
      await this.upsertCache(tenantId, info);
      return info;
    } catch (err) {
      this.logger.error('License server unreachable', err);
      if (cached) return { tier: cached.tier, features: cached.features as string[], expiresAt: cached.expiresAt };
      return BASIC;
    }
  }

  private async upsertCache(tenantId: string, info: LicenseInfo): Promise<void> {
    const licenseKey = this.config.get<string>('LICENSE_KEY') ?? '';
    await this.prisma.licenseCache.upsert({
      where: { tenantId },
      create: { tenantId, licenseKey, tier: info.tier, features: info.features, expiresAt: info.expiresAt },
      update: { tier: info.tier, features: info.features, expiresAt: info.expiresAt, lastCheckedAt: new Date() },
    });
  }
}
