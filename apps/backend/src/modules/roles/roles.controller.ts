import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { RolesService } from './roles.service.js';
import { CreateRoleDto, AssignPermissionDto } from './dto/create-role.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @CheckPermissions({ module: 'roles', action: 'view' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @ApiOperation({ summary: 'Get all roles with their permissions' })
  async findAll() {
    const roles = await this.rolesService.findAll();
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isDefault: role.isDefault,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    }));
  }

  @Post()
  @CheckPermissions({ module: 'roles', action: 'create' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  @ApiOperation({ summary: 'Create a new custom role' })
  async create(@Body() dto: CreateRoleDto) {
    const role = await this.rolesService.create(dto);
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isDefault: role.isDefault,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    };
  }

  @Delete(':id')
  @CheckPermissions({ module: 'roles', action: 'delete' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @ApiOperation({
    summary: 'Delete a custom role (system roles cannot be deleted)',
  })
  async delete(@Param('id', uuidPipe) id: string) {
    return this.rolesService.delete(id);
  }

  @Post(':id/permissions')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  @ApiOperation({ summary: 'Assign a permission to a role' })
  async assignPermission(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.assignPermission(id, dto.module, dto.action);
  }

  /**
   * POST :id/permissions/remove — proxy-safe alternative to DELETE :id/permissions
   * Some proxies/CDNs strip the body from DELETE requests.
   * Both endpoints do the same thing — use POST from the frontend.
   */
  @Post(':id/permissions/remove')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @ApiOperation({
    summary: 'Remove a permission from a role (proxy-safe POST variant)',
  })
  async removePermissionPost(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.removePermission(id, dto.module, dto.action);
  }

  /**
   * @deprecated Use POST :id/permissions/remove instead.
   * Kept for backward compatibility — some HTTP clients handle DELETE+body correctly.
   */
  @Delete(':id/permissions')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  @ApiOperation({
    summary: 'Remove a permission from a role (deprecated — use POST /remove)',
  })
  async removePermission(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.removePermission(id, dto.module, dto.action);
  }
}
