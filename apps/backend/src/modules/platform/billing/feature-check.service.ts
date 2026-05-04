import { Injectable } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { SubscriptionCacheService } from './subscription-cache.service';
import { FEATURE_KEY_MAP } from './feature-key-map';

@Injectable()
export class FeatureCheckService {
  constructor(private readonly cache: SubscriptionCacheService) {}

  async isEnabled(organizationId: string, key: FeatureKey): Promise<boolean> {
    const sub = await this.cache.get(organizationId);
    if (!sub) return false;
    const jsonKey = FEATURE_KEY_MAP[key];
    const value = (sub.limits as Record<string, unknown>)[jsonKey];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  }
}
