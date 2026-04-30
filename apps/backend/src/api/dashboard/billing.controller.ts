import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtGuard } from "../../common/guards/jwt.guard";
import { ApiStandardResponses } from "../../common/swagger";
import { ListPlansHandler } from "../../modules/platform/billing/list-plans/list-plans.handler";
import { GetCurrentSubscriptionHandler } from "../../modules/platform/billing/get-current-subscription/get-current-subscription.handler";
import { GetMyFeaturesHandler } from "../../modules/platform/billing/get-my-features/get-my-features.handler";
import { StartSubscriptionHandler } from "../../modules/platform/billing/start-subscription/start-subscription.handler";
import { UpgradePlanHandler } from "../../modules/platform/billing/upgrade-plan/upgrade-plan.handler";
import { DowngradePlanHandler } from "../../modules/platform/billing/downgrade-plan/downgrade-plan.handler";
import { CancelSubscriptionHandler } from "../../modules/platform/billing/cancel-subscription/cancel-subscription.handler";
import { ResumeSubscriptionHandler } from "../../modules/platform/billing/resume-subscription/resume-subscription.handler";
import { StartSubscriptionDto } from "../../modules/platform/billing/dto/start-subscription.dto";
import { ChangePlanDto } from "../../modules/platform/billing/dto/change-plan.dto";
import { AddSavedCardDto } from "../../modules/platform/billing/dto/saved-card.dto";
import { AddSavedCardHandler } from "../../modules/platform/billing/saved-cards/add-saved-card.handler";
import { ListSavedCardsHandler } from "../../modules/platform/billing/saved-cards/list-saved-cards.handler";
import { RemoveSavedCardHandler } from "../../modules/platform/billing/saved-cards/remove-saved-card.handler";
import { SetDefaultSavedCardHandler } from "../../modules/platform/billing/saved-cards/set-default-saved-card.handler";

@ApiTags("Dashboard / Billing")
@ApiBearerAuth()
@ApiStandardResponses()
@Controller("dashboard/billing")
@UseGuards(JwtGuard)
export class BillingController {
  constructor(
    private readonly listPlans: ListPlansHandler,
    private readonly getCurrentSub: GetCurrentSubscriptionHandler,
    private readonly getMyFeatures: GetMyFeaturesHandler,
    private readonly startSub: StartSubscriptionHandler,
    private readonly upgrade: UpgradePlanHandler,
    private readonly downgrade: DowngradePlanHandler,
    private readonly cancel: CancelSubscriptionHandler,
    private readonly resume: ResumeSubscriptionHandler,
    private readonly listSavedCards: ListSavedCardsHandler,
    private readonly addSavedCard: AddSavedCardHandler,
    private readonly setDefaultSavedCard: SetDefaultSavedCardHandler,
    private readonly removeSavedCard: RemoveSavedCardHandler,
  ) {}

  @Get("plans")
  @ApiOperation({ summary: "List available subscription plans" })
  plans() {
    return this.listPlans.execute();
  }

  @Get("subscription")
  @ApiOperation({ summary: "Get current subscription" })
  subscription() {
    return this.getCurrentSub.execute();
  }

  @Get("my-features")
  @ApiOperation({ summary: "Get my billing features with current usage" })
  myFeatures() {
    return this.getMyFeatures.execute();
  }

  @Post("subscription/start")
  @ApiOperation({ summary: "Start a new subscription (TRIALING)" })
  start(@Body() dto: StartSubscriptionDto) {
    return this.startSub.execute(dto);
  }

  @Post("subscription/upgrade")
  @ApiOperation({ summary: "Upgrade subscription plan" })
  upgradePlan(@Body() dto: ChangePlanDto) {
    return this.upgrade.execute(dto);
  }

  @Post("subscription/downgrade")
  @ApiOperation({ summary: "Downgrade subscription plan" })
  downgradePlan(@Body() dto: ChangePlanDto) {
    return this.downgrade.execute(dto);
  }

  @Post("subscription/cancel")
  @ApiOperation({ summary: "Cancel subscription" })
  cancelSub(@Body() body: { reason?: string }) {
    return this.cancel.execute(body);
  }

  @Post("subscription/resume")
  @HttpCode(200)
  @ApiOperation({ summary: "Resume a suspended subscription" })
  resumeSub() {
    return this.resume.execute({});
  }

  @Get("saved-cards")
  @ApiOperation({ summary: "List saved billing cards" })
  savedCards() {
    return this.listSavedCards.execute();
  }

  @Post("saved-cards")
  @ApiOperation({ summary: "Add a saved billing card" })
  addCard(@Body() dto: AddSavedCardDto) {
    return this.addSavedCard.execute(dto);
  }

  @Patch("saved-cards/:id/set-default")
  @HttpCode(200)
  @ApiOperation({ summary: "Set saved billing card as default" })
  setDefaultCard(@Param("id") id: string) {
    return this.setDefaultSavedCard.execute(id);
  }

  @Delete("saved-cards/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove a saved billing card" })
  removeCard(@Param("id") id: string) {
    return this.removeSavedCard.execute(id);
  }
}
