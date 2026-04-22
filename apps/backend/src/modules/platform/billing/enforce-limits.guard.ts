import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { ENFORCE_LIMIT_KEY, LimitKind } from './plan-limits.decorator';

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.get<LimitKind>(ENFORCE_LIMIT_KEY, ctx.getHandler());
    if (!kind) return true;

    const organizationId = this.tenant.requireOrganizationId();
    const cached = await this.cache.get(organizationId);

    // No subscription → allow (dev/trial before billing goes live)
    if (!cached) return true;

    if (cached.status === 'CANCELED' || cached.status === 'SUSPENDED') {
      throw new ForbiddenException(`Subscription is ${cached.status}`);
    }

    const limit = this.resolveLimit(kind, cached.limits);
    if (limit === -1) return true; // unlimited

    const current = await this.currentUsage(kind, organizationId);
    if (current >= limit) {
      throw new ForbiddenException(`Plan limit reached for ${kind}: ${current}/${limit}`);
    }
    return true;
  }

  private resolveLimit(kind: LimitKind, limits: Record<string, number | boolean>): number {
    switch (kind) {
      case 'BRANCHES': return Number(limits['maxBranches'] ?? 0);
      case 'EMPLOYEES': return Number(limits['maxEmployees'] ?? 0);
    }
  }

  private async currentUsage(kind: LimitKind, organizationId: string): Promise<number> {
    switch (kind) {
      case 'BRANCHES':
        return this.prisma.branch.count({ where: { organizationId, isActive: true } });
      case 'EMPLOYEES':
        return this.prisma.employee.count({ where: { organizationId } });
    }
  }
}
