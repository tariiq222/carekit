import { Module } from '@nestjs/common';
import { GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';

@Module({
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
