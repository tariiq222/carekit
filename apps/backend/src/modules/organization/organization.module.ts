import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { CreateBranchHandler } from './branches/create-branch.handler';
import { UpdateBranchHandler } from './branches/update-branch.handler';
import { ListBranchesHandler } from './branches/list-branches.handler';
import { GetBranchHandler } from './branches/get-branch.handler';
import { CreateServiceHandler } from './services/create-service.handler';
import { UpdateServiceHandler } from './services/update-service.handler';
import { ListServicesHandler } from './services/list-services.handler';
import { ArchiveServiceHandler } from './services/archive-service.handler';
import { SetBusinessHoursHandler } from './hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from './hours/get-business-hours.handler';
import { AddHolidayHandler } from './hours/add-holiday.handler';
import { RemoveHolidayHandler } from './hours/remove-holiday.handler';
import { ListHolidaysHandler } from './hours/list-holidays.handler';

const branchHandlers = [
  CreateBranchHandler, UpdateBranchHandler, ListBranchesHandler, GetBranchHandler,
];

const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, ArchiveServiceHandler,
];

const hoursHandlers = [
  SetBusinessHoursHandler, GetBusinessHoursHandler,
  AddHolidayHandler, RemoveHolidayHandler, ListHolidaysHandler,
];

@Module({
  imports: [DatabaseModule],
  providers: [...branchHandlers, ...serviceHandlers, ...hoursHandlers],
  exports: [...branchHandlers, ...serviceHandlers, ...hoursHandlers],
})
export class OrganizationModule {}
