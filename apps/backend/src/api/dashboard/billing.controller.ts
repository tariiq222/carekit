import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { ListPlansHandler } from '../../modules/platform/billing/list-plans/list-plans.handler';
import { GetCurrentSubscriptionHandler } from '../../modules/platform/billing/get-current-subscription/get-current-subscription.handler';
import { StartSubscriptionHandler } from '../../modules/platform/billing/start-subscription/start-subscription.handler';
import { UpgradePlanHandler } from '../../modules/platform/billing/upgrade-plan/upgrade-plan.handler';
import { DowngradePlanHandler } from '../../modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { CancelSubscriptionHandler } from '../../modules/platform/billing/cancel-subscription/cancel-subscription.handler';
import { ResumeSubscriptionHandler } from '../../modules/platform/billing/resume-subscription/resume-subscription.handler';
import { StartSubscriptionDto } from '../../modules/platform/billing/dto/start-subscription.dto';
import { ChangePlanDto } from '../../modules/platform/billing/dto/change-plan.dto';

@ApiTags('Dashboard / Billing')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/billing')
@UseGuards(JwtGuard)
export class BillingController {
  constructor(
    private readonly listPlans: ListPlansHandler,
    private readonly getCurrentSub: GetCurrentSubscriptionHandler,
    private readonly startSub: StartSubscriptionHandler,
    private readonly upgrade: UpgradePlanHandler,
    private readonly downgrade: DowngradePlanHandler,
    private readonly cancel: CancelSubscriptionHandler,
    private readonly resume: ResumeSubscriptionHandler,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  plans() { return this.listPlans.execute(); }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription' })
  subscription() { return this.getCurrentSub.execute(); }

  @Post('subscription/start')
  @ApiOperation({ summary: 'Start a new subscription (TRIALING)' })
  start(@Body() dto: StartSubscriptionDto) { return this.startSub.execute(dto); }

  @Post('subscription/upgrade')
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  upgradePlan(@Body() dto: ChangePlanDto) { return this.upgrade.execute(dto); }

  @Post('subscription/downgrade')
  @ApiOperation({ summary: 'Downgrade subscription plan' })
  downgradePlan(@Body() dto: ChangePlanDto) { return this.downgrade.execute(dto); }

  @Post('subscription/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancelSub(@Body() body: { reason?: string }) { return this.cancel.execute(body); }

  @Post('subscription/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resume a suspended subscription' })
  resumeSub() { return this.resume.execute({}); }
}
