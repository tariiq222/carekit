import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { DatabaseModule } from "../../../infrastructure/database/database.module";
import { MailModule } from "../../../infrastructure/mail";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { SUBSCRIPTION_CACHE_TOKEN } from "../../../common/tenant/tenant-context.service";
import { BillingController } from "../../../api/dashboard/billing.controller";
import { SubscriptionStateMachine } from "./subscription-state-machine";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { UsageAggregatorService } from "./usage-aggregator.service";
import { ListPlansHandler } from "./list-plans/list-plans.handler";
import { GetCurrentSubscriptionHandler } from "./get-current-subscription/get-current-subscription.handler";
import { GetMyFeaturesHandler } from "./get-my-features/get-my-features.handler";
import { StartSubscriptionHandler } from "./start-subscription/start-subscription.handler";
import { UpgradePlanHandler } from "./upgrade-plan/upgrade-plan.handler";
import { DowngradePlanHandler } from "./downgrade-plan/downgrade-plan.handler";
import { CancelSubscriptionHandler } from "./cancel-subscription/cancel-subscription.handler";
import { ProcessScheduledCancellationsCron } from "./process-scheduled-cancellations/process-scheduled-cancellations.cron";
import { ReactivateSubscriptionHandler } from "./reactivate-subscription/reactivate-subscription.handler";
import { ResumeSubscriptionHandler } from "./resume-subscription/resume-subscription.handler";
import { RecordSubscriptionPaymentHandler } from "./record-subscription-payment/record-subscription-payment.handler";
import { RecordSubscriptionPaymentFailureHandler } from "./record-subscription-payment-failure/record-subscription-payment-failure.handler";
import { AddSavedCardHandler } from "./saved-cards/add-saved-card.handler";
import { ListSavedCardsHandler } from "./saved-cards/list-saved-cards.handler";
import { RemoveSavedCardHandler } from "./saved-cards/remove-saved-card.handler";
import { SetDefaultSavedCardHandler } from "./saved-cards/set-default-saved-card.handler";
import { MoyasarSubscriptionClient } from "../../finance/moyasar-api/moyasar-subscription.client";
import { PlanLimitsGuard } from "./enforce-limits.guard";
import { FeatureGuard } from "./feature.guard";
import { UsageTrackerInterceptor } from "./usage-tracker.interceptor";

const HANDLERS = [
  ListPlansHandler,
  GetCurrentSubscriptionHandler,
  GetMyFeaturesHandler,
  StartSubscriptionHandler,
  UpgradePlanHandler,
  DowngradePlanHandler,
  CancelSubscriptionHandler,
  ProcessScheduledCancellationsCron,
  ReactivateSubscriptionHandler,
  ResumeSubscriptionHandler,
  ListSavedCardsHandler,
  AddSavedCardHandler,
  SetDefaultSavedCardHandler,
  RemoveSavedCardHandler,
  RecordSubscriptionPaymentHandler,
  RecordSubscriptionPaymentFailureHandler,
  MoyasarSubscriptionClient,
];

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [BillingController],
  providers: [
    SubscriptionStateMachine,
    // Factory avoids DI trying to inject the optional 'options' parameter
    // (index [1] in the constructor) — it's for unit-test injection only.
    {
      provide: SubscriptionCacheService,
      useFactory: (prisma: PrismaService) =>
        new SubscriptionCacheService(prisma),
      inject: [PrismaService],
    },
    UsageAggregatorService,
    // Expose SubscriptionCacheService under the token TenantContextService expects
    {
      provide: SUBSCRIPTION_CACHE_TOKEN,
      useExisting: SubscriptionCacheService,
    },
    ...HANDLERS,
    { provide: APP_GUARD, useClass: PlanLimitsGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_INTERCEPTOR, useClass: UsageTrackerInterceptor },
  ],
  exports: [
    SubscriptionCacheService,
    UsageAggregatorService,
    SubscriptionStateMachine,
    ...HANDLERS,
  ],
})
export class BillingModule {}
