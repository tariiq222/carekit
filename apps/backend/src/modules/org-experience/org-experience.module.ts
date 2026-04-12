import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { DashboardOrganizationSettingsController } from '../../api/dashboard/organization-settings.controller';
import { CreateServiceHandler } from './services/create-service.handler';
import { UpdateServiceHandler } from './services/update-service.handler';
import { ListServicesHandler } from './services/list-services.handler';
import { ArchiveServiceHandler } from './services/archive-service.handler';
import { PriceResolverService } from './services/price-resolver.service';
import { SetDurationOptionsHandler } from './services/set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './services/set-employee-service-options.handler';
import { UpsertBrandingHandler } from './branding/upsert-branding.handler';
import { GetBrandingHandler } from './branding/get-branding.handler';
import { CreateIntakeFormHandler } from './intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from './intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from './intake-forms/list-intake-forms.handler';
import { DeleteIntakeFormHandler } from './intake-forms/delete-intake-form.handler';
import { SubmitRatingHandler } from './ratings/submit-rating.handler';
import { ListRatingsHandler } from './ratings/list-ratings.handler';
import { GetOrgSettingsHandler } from './org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from './org-settings/upsert-org-settings.handler';
import { GetBookingSettingsHandler } from '../bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../bookings/upsert-booking-settings/upsert-booking-settings.handler';

const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, ArchiveServiceHandler,
  PriceResolverService, SetDurationOptionsHandler, SetEmployeeServiceOptionsHandler,
];

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardOrganizationSettingsController],
  providers: [
    ...serviceHandlers,
    UpsertBrandingHandler, GetBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    SubmitRatingHandler, ListRatingsHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler,
    GetBookingSettingsHandler, UpsertBookingSettingsHandler,
  ],
  exports: [
    ...serviceHandlers,
    UpsertBrandingHandler, GetBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    SubmitRatingHandler, ListRatingsHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler,
    GetBookingSettingsHandler, UpsertBookingSettingsHandler,
  ],
})
export class OrgExperienceModule {}
