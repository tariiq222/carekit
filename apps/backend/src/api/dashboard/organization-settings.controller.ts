import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { UpsertBrandingHandler } from '../../modules/organization/branding/upsert-branding.handler';
import { GetBrandingHandler } from '../../modules/organization/branding/get-branding.handler';
import { CreateIntakeFormHandler } from '../../modules/organization/intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from '../../modules/organization/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/organization/intake-forms/list-intake-forms.handler';
import { SubmitRatingHandler } from '../../modules/organization/ratings/submit-rating.handler';
import { ListRatingsHandler } from '../../modules/organization/ratings/list-ratings.handler';

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
    @Body() body: Record<string, unknown>,
  ) {
    return this.upsertBranding.execute({ tenantId, ...body } as Parameters<typeof this.upsertBranding.execute>[0]);
  }

  @Get('branding')
  getBrandingEndpoint(@TenantId() tenantId: string) {
    return this.getBranding.execute({ tenantId });
  }

  // ── Intake Forms ──────────────────────────────────────────────────────────

  @Post('intake-forms')
  createIntakeFormEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createIntakeForm.execute({ tenantId, ...body } as Parameters<typeof this.createIntakeForm.execute>[0]);
  }

  @Get('intake-forms')
  listIntakeFormsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listIntakeForms.execute({ tenantId, ...query } as Parameters<typeof this.listIntakeForms.execute>[0]);
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
    @Body() body: Record<string, unknown>,
  ) {
    return this.submitRating.execute({ tenantId, ...body } as Parameters<typeof this.submitRating.execute>[0]);
  }

  @Get('ratings')
  listRatingsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listRatings.execute({ tenantId, ...query } as Parameters<typeof this.listRatings.execute>[0]);
  }
}
