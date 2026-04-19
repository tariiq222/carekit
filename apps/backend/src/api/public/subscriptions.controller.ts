import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiPublicResponses } from '../../common/swagger';
import { ListPublicSubscriptionsHandler } from '../../modules/subscriptions/list-public-subscriptions.handler';
import { PurchaseSubscriptionHandler } from '../../modules/subscriptions/purchase-subscription.handler';
import { GetMySubscriptionsHandler } from '../../modules/subscriptions/get-my-subscriptions.handler';

class PurchaseSubscriptionDto {
  planId!: string;
  branchId!: string;
  successUrl!: string;
  failUrl!: string;
}

@ApiTags('Public / Subscriptions')
@ApiPublicResponses()
@Controller('public/subscriptions')
export class PublicSubscriptionsController {
  constructor(
    private readonly listPublic: ListPublicSubscriptionsHandler,
    private readonly purchase: PurchaseSubscriptionHandler,
    private readonly getMy: GetMySubscriptionsHandler,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all public subscription plans' })
  async listPublicSubscriptions(@Query('branchId') branchId?: string) {
    return this.listPublic.execute(branchId);
  }

  @Public()
  @UseGuards(ClientSessionGuard)
  @Post('purchase')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Purchase a subscription plan (requires client session)' })
  async purchaseSubscription(
    @ClientSession() session: { id: string },
    @Body() dto: PurchaseSubscriptionDto,
  ) {
    return this.purchase.execute({
      ...dto,
      clientId: session.id,
    });
  }

  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Get('my')
  @ApiOperation({ summary: 'Get my subscriptions (requires client auth)' })
  async getMySubscriptions(@ClientSession() session: { id: string }) {
    return this.getMy.execute(session.id);
  }
}