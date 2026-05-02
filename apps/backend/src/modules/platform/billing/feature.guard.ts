import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BookingStatus } from "@prisma/client";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { TenantContextService } from "../../../common/tenant/tenant-context.service";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { REQUIRE_FEATURE_KEY } from "./feature.decorator";
import { FEATURE_KEY_MAP } from "./feature-key-map";
import { FeatureNotEnabledException } from "./feature-not-enabled.exception";

interface CachedFeatures {
  features: Record<string, number | boolean>;
  planSlug: string;
  expiresAt: number;
}

@Injectable()
export class FeatureGuard implements CanActivate {
  private readonly cache = new Map<string, CachedFeatures>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cacheService: SubscriptionCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<FeatureKey>(
      REQUIRE_FEATURE_KEY,
      ctx.getHandler(),
    );

    // No metadata → permissive
    if (!featureKey) return true;

    const organizationId = this.tenant.requireOrganizationId();
    const { features, planSlug } = await this.resolveFeatures(organizationId);

    const jsonKey = FEATURE_KEY_MAP[featureKey];
    const value = features[jsonKey];

    // On/off boolean flag
    if (typeof value === "boolean") {
      if (value === false) {
        throw new FeatureNotEnabledException(featureKey, planSlug);
      }
      return true;
    }

    // Quantitative flag (limit stored as number; -1 = unlimited)
    if (typeof value === "number") {
      if (value === -1) return true;
      const current = await this.currentUsage(featureKey, organizationId);
      if (current >= value) {
        throw new ForbiddenException(
          `Feature limit reached for '${featureKey}': ${current}/${value}`,
        );
      }
    }

    return true;
  }

  private async resolveFeatures(
    organizationId: string,
  ): Promise<{ features: Record<string, number | boolean>; planSlug: string }> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return { features: cached.features, planSlug: cached.planSlug };
    }

    const sub = await this.cacheService.get(organizationId);
    if (!sub) return { features: {}, planSlug: "" };

    const entry: CachedFeatures = {
      features: sub.limits,
      planSlug: sub.planSlug,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.cache.set(organizationId, entry);
    return { features: entry.features, planSlug: entry.planSlug };
  }

  private async currentUsage(
    key: FeatureKey,
    organizationId: string,
  ): Promise<number> {
    switch (key) {
      case FeatureKey.BRANCHES:
        return this.prisma.branch.count({
          where: { organizationId, isActive: true },
        });
      case FeatureKey.EMPLOYEES:
        return this.prisma.employee.count({ where: { organizationId } });
      case FeatureKey.SERVICES:
        return this.prisma.service.count({
          where: { organizationId, isActive: true },
        });
      case FeatureKey.MONTHLY_BOOKINGS: {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return this.prisma.booking.count({
          where: {
            organizationId,
            scheduledAt: { gte: startOfMonth },
            status: { not: BookingStatus.CANCELLED },
          },
        });
      }
      default:
        return 0;
    }
  }
}
