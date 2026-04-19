import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { FinanceModule } from '../finance/finance.module';
import { ListPublicSubscriptionsHandler } from './list-public-subscriptions.handler';
import { PurchaseSubscriptionHandler } from './purchase-subscription.handler';
import { GetMySubscriptionsHandler } from './get-my-subscriptions.handler';

const handlers = [
  ListPublicSubscriptionsHandler,
  PurchaseSubscriptionHandler,
  GetMySubscriptionsHandler,
];

@Module({
  imports: [DatabaseModule, FinanceModule],
  providers: [...handlers],
  exports: [...handlers],
})
export class SubscriptionsModule {}
