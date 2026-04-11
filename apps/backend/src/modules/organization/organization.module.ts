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

const branchHandlers = [
  CreateBranchHandler, UpdateBranchHandler, ListBranchesHandler, GetBranchHandler,
];

const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, ArchiveServiceHandler,
];

@Module({
  imports: [DatabaseModule],
  providers: [...branchHandlers, ...serviceHandlers],
  exports: [...branchHandlers, ...serviceHandlers],
})
export class OrganizationModule {}
