import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserRolesService } from './user-roles.service.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';

@Module({
  imports: [forwardRef(() => PractitionersModule), AuthModule, ActivityLogModule],
  controllers: [UsersController],
  providers: [UsersService, UserRolesService],
  exports: [UsersService],
})
export class UsersModule {}
