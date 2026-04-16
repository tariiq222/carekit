import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { ListUsersHandler } from '../../modules/identity/users/list-users.handler';
import { CreateUserHandler } from '../../modules/identity/users/create-user.handler';
import { UpdateUserHandler } from '../../modules/identity/users/update-user.handler';
import { DeactivateUserHandler } from '../../modules/identity/users/deactivate-user.handler';
import { DeleteUserHandler } from '../../modules/identity/users/delete-user.handler';
import { AssignRoleHandler } from '../../modules/identity/users/assign-role.handler';
import { RemoveRoleHandler } from '../../modules/identity/users/remove-role.handler';
import { ListRolesHandler } from '../../modules/identity/roles/list-roles.handler';
import { CreateRoleHandler } from '../../modules/identity/roles/create-role.handler';
import { DeleteRoleHandler } from '../../modules/identity/roles/delete-role.handler';
import { AssignPermissionsHandler } from '../../modules/identity/roles/assign-permissions.handler';
import { ListPermissionsHandler } from '../../modules/identity/roles/list-permissions.handler';
import { CreateUserDto } from '../../modules/identity/users/create-user.dto';
import { CreateRoleDto } from '../../modules/identity/roles/create-role.dto';
import { AssignPermissionsDto } from '../../modules/identity/roles/assign-permissions.dto';
import { IsOptional, IsString, IsBoolean, IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ListUsersQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() customRoleId?: string | null;
}

class AssignRoleDto {
  @IsUUID() customRoleId!: string;
}

@ApiTags('Identity')
@ApiBearerAuth()
@Controller('dashboard/identity')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardIdentityController {
  constructor(
    private readonly listUsersHandler: ListUsersHandler,
    private readonly createUserHandler: CreateUserHandler,
    private readonly updateUserHandler: UpdateUserHandler,
    private readonly deactivateUserHandler: DeactivateUserHandler,
    private readonly deleteUserHandler: DeleteUserHandler,
    private readonly assignRoleHandler: AssignRoleHandler,
    private readonly removeRoleHandler: RemoveRoleHandler,
    private readonly listRolesHandler: ListRolesHandler,
    private readonly createRoleHandler: CreateRoleHandler,
    private readonly deleteRoleHandler: DeleteRoleHandler,
    private readonly assignPermissionsHandler: AssignPermissionsHandler,
    private readonly listPermissionsHandler: ListPermissionsHandler,
  ) {}

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.listUsersHandler.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
    });
  }

  @Post('users')
  async createUserEndpoint(@Body() body: CreateUserDto) {
    return this.createUserHandler.execute(body);
  }

  @Patch('users/:id')
  async updateUserEndpoint(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.updateUserHandler.execute({ ...body, userId });
  }

  @Patch('users/:id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateUserEndpoint(@Param('id', ParseUUIDPipe) userId: string) {
    await this.deactivateUserHandler.execute({ userId });
  }

  @Patch('users/:id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async activateUserEndpoint(@Param('id', ParseUUIDPipe) userId: string) {
    await this.updateUserHandler.execute({ userId, isActive: true });
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserEndpoint(@Param('id', ParseUUIDPipe) userId: string) {
    await this.deleteUserHandler.execute({ userId });
  }

  @Post('users/:userId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignRoleEndpoint(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AssignRoleDto,
  ) {
    await this.assignRoleHandler.execute({ userId, customRoleId: body.customRoleId });
  }

  @Delete('users/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRoleEndpoint(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) customRoleId: string,
  ) {
    await this.removeRoleHandler.execute({ userId, customRoleId });
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  @Get('roles')
  async listRoles() {
    return this.listRolesHandler.execute();
  }

  @Post('roles')
  async createRoleEndpoint(@Body() body: CreateRoleDto) {
    return this.createRoleHandler.execute(body);
  }

  @Post('roles/:id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignPermissionsEndpoint(
    @Param('id', ParseUUIDPipe) customRoleId: string,
    @Body() body: AssignPermissionsDto,
  ) {
    await this.assignPermissionsHandler.execute({ ...body, customRoleId });
  }

  @Get('permissions')
  async listPermissions() {
    return this.listPermissionsHandler.execute();
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoleEndpoint(@Param('id', ParseUUIDPipe) customRoleId: string) {
    await this.deleteRoleHandler.execute({ customRoleId });
  }
}
