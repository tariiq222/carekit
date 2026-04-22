import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';

@Injectable()
export class ResumeSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
  ) {}

  async execute(_: Record<string, never>) {
    const organizationId = this.tenant.requireOrganizationId();

    const sub = await this.prisma.subscription.findFirst({ where: { organizationId } });
    if (!sub) throw new NotFoundException('No subscription found');
    if (!sub.moyasarCardTokenRef) {
      throw new BadRequestException(
        'No payment method on file — add a card before resuming',
      );
    }

    // Throws on illegal transition (only SUSPENDED → resumeSuccess is valid)
    this.stateMachine.transition(sub.status, { type: 'resumeSuccess' });

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', pastDueSince: null },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }
}
