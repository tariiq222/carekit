import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListUsersHandler } from '../../modules/identity/users/list-users.handler';
import { CreateUserHandler } from '../../modules/identity/users/create-user.handler';
import { UpdateUserHandler } from '../../modules/identity/users/update-user.handler';
import { DeactivateUserHandler } from '../../modules/identity/users/deactivate-user.handler';
import { ListRolesHandler } from '../../modules/identity/roles/list-roles.handler';
import { CreateRoleHandler } from '../../modules/identity/roles/create-role.handler';
import { AssignPermissionsHandler } from '../../modules/identity/roles/assign-permissions.handler';
import { CreateUserDto } from '../../modules/identity/users/create-user.dto';
import { CreateRoleDto } from '../../modules/identity/roles/create-role.dto';
import { AssignPermissionsDto } from '../../modules/identity/roles/assign-permissions.dto';
import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
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

@Controller('dashboard/identity')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardIdentityController {
  constructor(
    private readonly listUsersHandler: ListUsersHandler,
    private readonly createUserHandler: CreateUserHandler,
    private readonly updateUserHandler: UpdateUserHandler,
    private readonly deactivateUserHandler: DeactivateUserHandler,
    private readonly listRolesHandler: ListRolesHandler,
    private readonly createRoleHandler: CreateRoleHandler,
    private readonly assignPermissionsHandler: AssignPermissionsHandler,
  ) {}

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  async listUsers(@TenantId() tenantId: string, @Query() query: ListUsersQueryDto) {
    return this.listUsersHandler.execute({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
    });
  }

  @Post('users')
  async createUserEndpoint(@TenantId() tenantId: string, @Body() body: CreateUserDto) {
    return this.createUserHandler.execute({ ...body, tenantId });
  }

  @Patch('users/:id')
  async updateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.updateUserHandler.execute({ ...body, userId, tenantId });
  }

  @Patch('users/:id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
  ) {
    await this.deactivateUserHandler.execute({ userId, tenantId });
  }

  @Patch('users/:id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async activateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
  ) {
    await this.updateUserHandler.execute({ userId, tenantId, isActive: true } as never);
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  @Get('roles')
  async listRoles(@TenantId() tenantId: string) {
    return this.listRolesHandler.execute(tenantId);
  }

  @Post('roles')
  async createRoleEndpoint(@TenantId() tenantId: string, @Body() body: CreateRoleDto) {
    return this.createRoleHandler.execute({ ...body, tenantId });
  }

  @Post('roles/:id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignPermissionsEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) customRoleId: string,
    @Body() body: AssignPermissionsDto,
  ) {
    await this.assignPermissionsHandler.execute({ ...body, customRoleId, tenantId });
  }
}