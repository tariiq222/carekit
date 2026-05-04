import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EventBusService } from '../../../../infrastructure/events';
import { UsageCounterService } from './usage-counter.service';
import { EPOCH, startOfMonthUTC } from './period.util';

interface BookingCreatedPayload {
  bookingId: string;
  organizationId: string;
  scheduledAt: Date;
}

interface EmployeeCreatedPayload {
  employeeId: string;
  organizationId: string;
}

interface BranchCreatedPayload {
  branchId: string;
  organizationId: string;
}

interface ServiceCreatedPayload {
  serviceId: string;
  organizationId: string;
}

/**
 * Listens for domain events and increments the corresponding UsageCounter rows.
 *
 * Uses EventBusService (BullMQ-based) subscribe pattern — not @OnEvent —
 * because the project does not use @nestjs/event-emitter.
 *
 * All handlers are fire-and-forget: a counter increment failure should
 * never block or roll back the originating transaction.
 */
@Injectable()
export class IncrementUsageListener implements OnModuleInit {
  private readonly logger = new Logger(IncrementUsageListener.name);

  constructor(
    private readonly counters: UsageCounterService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<BookingCreatedPayload>(
      'bookings.booking.created',
      async (envelope) => {
        const { organizationId, scheduledAt } = envelope.payload;
        const occurredAt = scheduledAt ? new Date(scheduledAt) : new Date();
        await this.counters
          .increment(
            organizationId,
            FeatureKey.MONTHLY_BOOKINGS,
            startOfMonthUTC(occurredAt),
            1,
          )
          .catch((err: unknown) =>
            this.logger.error({ err, organizationId }, 'usage_counter_booking_increment_failed'),
          );
      },
    );

    this.eventBus.subscribe<EmployeeCreatedPayload>(
      'people.employee.created',
      async (envelope) => {
        const { organizationId } = envelope.payload;
        await this.counters
          .increment(organizationId, FeatureKey.EMPLOYEES, EPOCH, 1)
          .catch((err: unknown) =>
            this.logger.error({ err, organizationId }, 'usage_counter_employee_increment_failed'),
          );
      },
    );

    this.eventBus.subscribe<BranchCreatedPayload>(
      'org-config.branch.created',
      async (envelope) => {
        const { organizationId } = envelope.payload;
        await this.counters
          .increment(organizationId, FeatureKey.BRANCHES, EPOCH, 1)
          .catch((err: unknown) =>
            this.logger.error({ err, organizationId }, 'usage_counter_branch_increment_failed'),
          );
      },
    );

    this.eventBus.subscribe<ServiceCreatedPayload>(
      'org-experience.service.created',
      async (envelope) => {
        const { organizationId } = envelope.payload;
        await this.counters
          .increment(organizationId, FeatureKey.SERVICES, EPOCH, 1)
          .catch((err: unknown) =>
            this.logger.error({ err, organizationId }, 'usage_counter_service_increment_failed'),
          );
      },
    );
  }
}
