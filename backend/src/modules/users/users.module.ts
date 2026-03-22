import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserRolesService } from './user-roles.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserRolesService],
  exports: [UsersService],
})
export class UsersModule {}
