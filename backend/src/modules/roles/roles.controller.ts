import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async findAll() {
    const roles = await this.rolesService.findAll();
    // Transform to include permissions array
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
  async delete(@Param('id', uuidPipe) id: string) {
    return this.rolesService.delete(id);
  }

  @Post(':id/permissions')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async assignPermission(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.assignPermission(id, dto.module, dto.action);
  }

  @Delete(':id/permissions')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async removePermission(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.removePermission(id, dto.module, dto.action);
  }
}
