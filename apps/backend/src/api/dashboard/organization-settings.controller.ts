import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { UpsertBrandingHandler } from '../../modules/org-experience/branding/upsert-branding.handler';
import { UpsertBrandingDto } from '../../modules/org-experience/branding/upsert-branding.dto';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';
import { CreateIntakeFormHandler } from '../../modules/org-experience/intake-forms/create-intake-form.handler';
import { CreateIntakeFormDto } from '../../modules/org-experience/intake-forms/create-intake-form.dto';
import { GetIntakeFormHandler } from '../../modules/org-experience/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/org-experience/intake-forms/list-intake-forms.handler';
import { ListIntakeFormsDto } from '../../modules/org-experience/intake-forms/list-intake-forms.dto';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { SubmitRatingDto } from '../../modules/org-experience/ratings/submit-rating.dto';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { ListRatingsDto } from '../../modules/org-experience/ratings/list-ratings.dto';

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationSettingsController {
  constructor(
    private readonly upsertBranding: UpsertBrandingHandler,
    private readonly getBranding: GetBrandingHandler,
    private readonly createIntakeForm: CreateIntakeFormHandler,
    private readonly getIntakeForm: GetIntakeFormHandler,
    private readonly listIntakeForms: ListIntakeFormsHandler,
    private readonly submitRating: SubmitRatingHandler,
    private readonly listRatings: ListRatingsHandler,
  ) {}

  // ── Branding ──────────────────────────────────────────────────────────────

  @Post('branding')
  upsertBrandingEndpoint(
    @TenantId() tenantId: string,
    @Body() body: UpsertBrandingDto,
  ) {
    return this.upsertBranding.execute({ tenantId, ...body });
  }

  @Get('branding')
  getBrandingEndpoint(@TenantId() tenantId: string) {
    return this.getBranding.execute({ tenantId });
  }

  // ── Intake Forms ──────────────────────────────────────────────────────────

  @Post('intake-forms')
  createIntakeFormEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateIntakeFormDto,
  ) {
    return this.createIntakeForm.execute({ tenantId, ...body });
  }

  @Get('intake-forms')
  listIntakeFormsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListIntakeFormsDto,
  ) {
    return this.listIntakeForms.execute({ tenantId, ...query });
  }

  @Get('intake-forms/:formId')
  getIntakeFormEndpoint(
    @TenantId() tenantId: string,
    @Param('formId', ParseUUIDPipe) formId: string,
  ) {
    return this.getIntakeForm.execute({ tenantId, formId });
  }

  // ── Ratings ───────────────────────────────────────────────────────────────

  @Post('ratings')
  submitRatingEndpoint(
    @TenantId() tenantId: string,
    @Body() body: SubmitRatingDto,
  ) {
    return this.submitRating.execute({ tenantId, ...body });
  }

  @Get('ratings')
  listRatingsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListRatingsDto,
  ) {
    return this.listRatings.execute({ tenantId, ...query });
  }
}
