import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateServiceHandler } from '../../modules/org-experience/services/create-service.handler';
import { CreateServiceDto } from '../../modules/org-experience/services/create-service.dto';
import { UpdateServiceHandler } from '../../modules/org-experience/services/update-service.handler';
import { UpdateServiceDto } from '../../modules/org-experience/services/update-service.dto';
import { ListServicesHandler } from '../../modules/org-experience/services/list-services.handler';
import { ListServicesDto } from '../../modules/org-experience/services/list-services.dto';
import { ArchiveServiceHandler } from '../../modules/org-experience/services/archive-service.handler';
import { SetServiceBookingConfigsHandler } from '../../modules/org-experience/services/set-service-booking-configs.handler';
import { SetServiceBookingConfigsDto } from '../../modules/org-experience/services/set-service-booking-configs.dto';
import { GetServiceBookingConfigsHandler } from '../../modules/org-experience/services/get-service-booking-configs.handler';
import { UpsertBrandingHandler } from '../../modules/org-experience/branding/upsert-branding.handler';
import { UpsertBrandingDto } from '../../modules/org-experience/branding/upsert-branding.dto';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';
import { CreateIntakeFormHandler } from '../../modules/org-experience/intake-forms/create-intake-form.handler';
import { CreateIntakeFormDto } from '../../modules/org-experience/intake-forms/create-intake-form.dto';
import { GetIntakeFormHandler } from '../../modules/org-experience/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/org-experience/intake-forms/list-intake-forms.handler';
import { ListIntakeFormsDto } from '../../modules/org-experience/intake-forms/list-intake-forms.dto';
import { DeleteIntakeFormHandler } from '../../modules/org-experience/intake-forms/delete-intake-form.handler';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { SubmitRatingDto } from '../../modules/org-experience/ratings/submit-rating.dto';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { ListRatingsDto } from '../../modules/org-experience/ratings/list-ratings.dto';
import { GetOrgSettingsHandler } from '../../modules/org-experience/org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from '../../modules/org-experience/org-settings/upsert-org-settings.handler';
import { UpsertOrgSettingsDto } from '../../modules/org-experience/org-settings/upsert-org-settings.dto';
import { GetBookingSettingsHandler } from '../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { UploadLogoHandler } from '../../modules/org-experience/branding/upload-logo/upload-logo.handler';

@ApiTags('Services & Org')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationSettingsController {
  constructor(
    private readonly createService: CreateServiceHandler,
    private readonly updateService: UpdateServiceHandler,
    private readonly listServices: ListServicesHandler,
    private readonly archiveService: ArchiveServiceHandler,
    private readonly upsertBranding: UpsertBrandingHandler,
    private readonly getBranding: GetBrandingHandler,
    private readonly uploadLogo: UploadLogoHandler,
    private readonly createIntakeForm: CreateIntakeFormHandler,
    private readonly getIntakeForm: GetIntakeFormHandler,
    private readonly listIntakeForms: ListIntakeFormsHandler,
    private readonly deleteIntakeForm: DeleteIntakeFormHandler,
    private readonly submitRating: SubmitRatingHandler,
    private readonly listRatings: ListRatingsHandler,
    private readonly getOrgSettings: GetOrgSettingsHandler,
    private readonly upsertOrgSettings: UpsertOrgSettingsHandler,
    private readonly getBookingSettings: GetBookingSettingsHandler,
    private readonly upsertBookingSettings: UpsertBookingSettingsHandler,
    private readonly setServiceBookingConfigs: SetServiceBookingConfigsHandler,
    private readonly getServiceBookingConfigs: GetServiceBookingConfigsHandler,
  ) {}

  // ── Services ─────────────────────────────────────────────────────────────

  @Post('services')
  createServiceEndpoint(@Body() body: CreateServiceDto) {
    return this.createService.execute(body);
  }

  @Get('services')
  listServicesEndpoint(@Query() query: ListServicesDto) {
    return this.listServices.execute(query);
  }

  @Patch('services/:serviceId')
  updateServiceEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.updateService.execute({ serviceId, ...body });
  }

  @Delete('services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveServiceEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.archiveService.execute({ serviceId });
  }

  @Get('services/:serviceId/booking-types')
  getServiceBookingTypesEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.getServiceBookingConfigs.execute({ serviceId });
  }

  @Put('services/:serviceId/booking-types')
  setServiceBookingTypesEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetServiceBookingConfigsDto,
  ) {
    return this.setServiceBookingConfigs.execute({ serviceId, ...body });
  }

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

  @Post('branding/logo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogoEndpoint(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadLogo.execute(
      {
        tenantId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      file.buffer,
    );
  }

  // ── Intake Forms ──────────────────────────────────────────────────────────

  @Post('intake-forms')
  createIntakeFormEndpoint(@Body() body: CreateIntakeFormDto) {
    return this.createIntakeForm.execute(body);
  }

  @Get('intake-forms')
  listIntakeFormsEndpoint(@Query() query: ListIntakeFormsDto) {
    return this.listIntakeForms.execute(query);
  }

  @Get('intake-forms/:formId')
  getIntakeFormEndpoint(@Param('formId', ParseUUIDPipe) formId: string) {
    return this.getIntakeForm.execute({ formId });
  }

  @Delete('intake-forms/:formId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteIntakeFormEndpoint(@Param('formId', ParseUUIDPipe) formId: string) {
    return this.deleteIntakeForm.execute({ formId });
  }

  // ── Ratings ───────────────────────────────────────────────────────────────

  @Post('ratings')
  submitRatingEndpoint(@Body() body: SubmitRatingDto) {
    return this.submitRating.execute(body);
  }

  @Get('ratings')
  listRatingsEndpoint(@Query() query: ListRatingsDto) {
    return this.listRatings.execute(query);
  }

  // ── Organization Settings ─────────────────────────────────────────────────

  @Get('settings')
  getOrgSettingsEndpoint(@TenantId() tenantId: string) {
    return this.getOrgSettings.execute({ tenantId });
  }

  @Patch('settings')
  upsertOrgSettingsEndpoint(@TenantId() tenantId: string, @Body() body: UpsertOrgSettingsDto) {
    return this.upsertOrgSettings.execute({ tenantId, ...body });
  }

  // ── Booking Settings ──────────────────────────────────────────────────────

  @Get('booking-settings')
  getBookingSettingsEndpoint() {
    return this.getBookingSettings.execute({ branchId: null });
  }

  @Patch('booking-settings')
  upsertBookingSettingsEndpoint(@Body() body: Record<string, unknown>) {
    return this.upsertBookingSettings.execute({ branchId: null, ...body });
  }
}
