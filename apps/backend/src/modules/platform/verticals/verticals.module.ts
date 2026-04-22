import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { ListVerticalsHandler } from './list-verticals.handler';
import { GetVerticalHandler } from './get-vertical.handler';
import { GetTerminologyHandler } from './get-terminology.handler';
import { CreateVerticalHandler } from './create-vertical.handler';
import { UpdateVerticalHandler } from './update-vertical.handler';
import { DeleteVerticalHandler } from './delete-vertical.handler';
import { UpsertTerminologyOverrideHandler } from './upsert-terminology-override.handler';
import { UpsertSeedDepartmentHandler } from './upsert-seed-department.handler';
import { UpsertSeedServiceCategoryHandler } from './upsert-seed-service-category.handler';
import { SeedOrganizationFromVerticalHandler } from './seed-organization-from-vertical.handler';

@Module({
  imports: [DatabaseModule],
  providers: [
    ListVerticalsHandler,
    GetVerticalHandler,
    GetTerminologyHandler,
    CreateVerticalHandler,
    UpdateVerticalHandler,
    DeleteVerticalHandler,
    UpsertTerminologyOverrideHandler,
    UpsertSeedDepartmentHandler,
    UpsertSeedServiceCategoryHandler,
    SeedOrganizationFromVerticalHandler,
  ],
  exports: [
    ListVerticalsHandler,
    GetVerticalHandler,
    GetTerminologyHandler,
    CreateVerticalHandler,
    UpdateVerticalHandler,
    DeleteVerticalHandler,
    UpsertTerminologyOverrideHandler,
    UpsertSeedDepartmentHandler,
    UpsertSeedServiceCategoryHandler,
    SeedOrganizationFromVerticalHandler,
  ],
})
export class VerticalsModule {}
