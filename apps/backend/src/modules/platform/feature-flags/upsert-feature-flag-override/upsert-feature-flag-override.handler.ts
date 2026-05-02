import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuperAdminActionType } from '@prisma/client';
import type { OverrideMode } from './upsert-feature-flag-override.dto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { EventBusService } from '../../../../infrastructure/events/event-bus.service';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from '../../billing/events/subscription-updated.event';

export interface UpsertFeatureFlagOverrideCommand {
  organizationId: string;
  key: string;
  mode: OverrideMode;
  reason: string;
  superAdminUserId: string;
  /** Caller IP for audit trail — defaults to empty string when unavailable. */
  ipAddress?: string;
  /** User-agent for audit trail — defaults to empty string when unavailable. */
  userAgent?: string;
}

@Injectable()
export class UpsertFeatureFlagOverrideHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: UpsertFeatureFlagOverrideCommand): Promise<{ success: true }> {
    const { organizationId, key, mode, reason, superAdminUserId, ipAddress = '', userAgent = '' } = cmd;

    // Verify org exists
    const org = await this.prisma.$allTenants.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('organization_not_found');

    await this.prisma.$allTenants.$transaction(async (tx) => {
      if (mode === 'INHERIT') {
        // Remove the org-scoped override row entirely (no-op if absent)
        await tx.featureFlag.deleteMany({
          where: { organizationId, key },
        });
      } else {
        // Look up the platform-level catalog entry to copy metadata
        const platformFlag = await tx.featureFlag.findFirst({
          where: { key, organizationId: null },
          select: {
            allowedPlans: true,
            limitKind: true,
            nameAr: true,
            nameEn: true,
            descriptionAr: true,
            descriptionEn: true,
          },
        });
        if (!platformFlag) throw new NotFoundException('feature_flag_not_found');

        await tx.featureFlag.upsert({
          where: { organizationId_key: { organizationId, key } },
          create: {
            organizationId,
            key,
            enabled: mode === 'FORCE_ON',
            allowedPlans: platformFlag.allowedPlans,
            limitKind: platformFlag.limitKind,
            nameAr: platformFlag.nameAr,
            nameEn: platformFlag.nameEn,
            descriptionAr: platformFlag.descriptionAr,
            descriptionEn: platformFlag.descriptionEn,
          },
          update: { enabled: mode === 'FORCE_ON' },
        });
      }

      // Audit log: one row per override operation
      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId,
          actionType: SuperAdminActionType.FEATURE_FLAG_UPDATE,
          organizationId,
          reason,
          metadata: { key, mode } satisfies Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    // Emit cache invalidation after transaction commits.
    // Re-uses SUBSCRIPTION_UPDATED_EVENT so CacheInvalidatorListener flushes
    // FeatureGuard.sharedCache and SubscriptionCacheService for this org —
    // same wiring as plan-change events, zero new listener code required.
    await this.eventBus
      .publish<SubscriptionUpdatedPayload>(SUBSCRIPTION_UPDATED_EVENT, {
        eventId: `${SUBSCRIPTION_UPDATED_EVENT}:${organizationId}:${Date.now()}`,
        source: 'admin.upsert-feature-flag-override',
        version: 1,
        occurredAt: new Date(),
        payload: {
          organizationId,
          subscriptionId: '',
          reason: 'REACTIVATE', // closest semantic for "state changed"
        },
      })
      .catch(() => undefined);

    return { success: true };
  }
}
