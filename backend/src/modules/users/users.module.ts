import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserRolesService } from './user-roles.service.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';

@Module({
  imports: [forwardRef(() => PractitionersModule)],
  controllers: [UsersController],
  providers: [UsersService, UserRolesService],
  exports: [UsersService],
})
export class UsersModule {}
