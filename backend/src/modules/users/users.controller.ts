import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './dto/create-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Invalid UUID format',
      error: 'INVALID_UUID',
    });
  }
}

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @CheckPermissions({ module: 'users', action: 'view' })
  async findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      search,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @CheckPermissions({ module: 'users', action: 'view' })
  async findOne(@Param('id') id: string) {
    validateUuid(id);
    return this.usersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'users', action: 'create' })
  async create(@Body() dto: CreateUserDto) {
    const data = await this.usersService.create(dto);
    return {
      success: true,
      data,
      message: 'User created successfully',
    };
  }

  @Patch(':id')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    validateUuid(id);
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'users', action: 'delete' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    validateUuid(id);
    await this.usersService.softDelete(id, user.id);
    return { deleted: true };
  }

  @Patch(':id/activate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async activate(@Param('id') id: string) {
    validateUuid(id);
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    validateUuid(id);
    return this.usersService.deactivate(id, user.id);
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    validateUuid(id);

    let roleId = dto.roleId;

    // Support both roleId and roleSlug
    if (!roleId && dto.roleSlug) {
      const role = await this.prisma.role.findUnique({
        where: { slug: dto.roleSlug },
      });
      if (!role) {
        throw new BadRequestException({
          statusCode: 404,
          message: 'Role not found',
          error: 'ROLE_NOT_FOUND',
        });
      }
      roleId = role.id;
    }

    if (!roleId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'roleId or roleSlug is required',
        error: 'VALIDATION_ERROR',
      });
    }

    await this.usersService.assignRole(id, roleId);
    return {
      success: true,
      message: 'Role assigned successfully',
    };
  }

  @Delete(':id/roles/:roleId')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    validateUuid(id);
    validateUuid(roleId);
    await this.usersService.removeRole(id, roleId);
    return { removed: true };
  }
}
