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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { UsersService } from './users.service.js';
import { UserRolesService } from './user-roles.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
} from './dto/create-user.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userRolesService: UserRolesService,
  ) {}

  @Get()
  @CheckPermissions({ module: 'users', action: 'view' })
  @ApiOperation({ summary: 'List all users with filters' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'asc | desc' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role slug' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  @ApiResponse({ status: 200, description: 'Paginated user list returned' })
  @ApiStandardResponses()
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
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User returned' })
  @ApiStandardResponses()
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'users', action: 'create' })
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiStandardResponses()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.usersService.create(dto, user.id);
    return {
      success: true,
      data,
      message: 'User created successfully',
    };
  }

  @Patch(':id')
  @CheckPermissions({ module: 'users', action: 'edit' })
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiStandardResponses()
  async update(@Param('id', uuidPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'users', action: 'delete' })
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiStandardResponses()
  async delete(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.usersService.softDelete(id, user.id);
    return { deleted: true };
  }

  @Patch(':id/activate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  @ApiOperation({ summary: 'Activate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User activated' })
  @ApiStandardResponses()
  async activate(@Param('id', uuidPipe) id: string) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @CheckPermissions({ module: 'users', action: 'edit' })
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @ApiStandardResponses()
  async deactivate(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.deactivate(id, user.id);
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'roles', action: 'edit' })
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Role assigned' })
  @ApiStandardResponses()
  async assignRole(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() requester: { id: string },
  ) {
    await this.userRolesService.assignRole(
      id,
      dto.roleId,
      dto.roleSlug,
      requester.id,
    );
    return {
      success: true,
      message: 'Role assigned successfully',
    };
  }

  @Delete(':id/roles/:roleId')
  @CheckPermissions({ module: 'roles', action: 'edit' })
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role removed' })
  @ApiStandardResponses()
  async removeRole(
    @Param('id', uuidPipe) id: string,
    @Param('roleId', uuidPipe) roleId: string,
  ) {
    await this.userRolesService.removeRole(id, roleId);
    return { removed: true };
  }
}
