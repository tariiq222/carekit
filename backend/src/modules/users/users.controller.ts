import {
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './dto/create-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'users', action: 'create' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: { id: string }) {
    const data = await this.usersService.create(dto, user.id);
    return {
      success: true,
      data,
      message: 'User created successfully',
    };
  }

  @Patch(':id')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async update(@Param('id', uuidPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'users', action: 'delete' })
  async delete(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.usersService.softDelete(id, user.id);
    return { deleted: true };
  }

  @Patch(':id/activate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async activate(@Param('id', uuidPipe) id: string) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  async deactivate(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.deactivate(id, user.id);
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async assignRole(@Param('id', uuidPipe) id: string, @Body() dto: AssignRoleDto) {
    await this.usersService.assignRole(id, dto.roleId, dto.roleSlug);
    return {
      success: true,
      message: 'Role assigned successfully',
    };
  }

  @Delete(':id/roles/:roleId')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  async removeRole(
    @Param('id', uuidPipe) id: string,
    @Param('roleId', uuidPipe) roleId: string,
  ) {
    await this.usersService.removeRole(id, roleId);
    return { removed: true };
  }
}
