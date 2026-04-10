import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthCacheService } from '../auth/auth-cache.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'NOT_FOUND',
      });
    }
    return role;
  }

  async create(dto: CreateRoleDto) {
    const slug = dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '_');

    const existing = await this.prisma.role.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Role with this name already exists',
        error: 'CONFLICT',
      });
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        isSystem: false,
        isDefault: false,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  async delete(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'NOT_FOUND',
      });
    }

    // System roles cannot be deleted — only their permissions can be modified
    if (role.isSystem) {
      throw new BadRequestException({
        statusCode: 400,
        message:
          'Cannot delete system roles. You can modify their permissions from the dashboard.',
        error: 'SYSTEM_ROLE',
      });
    }

    // Find all users with this role before deleting it
    const affected = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });

    await this.prisma.role.delete({ where: { id } });

    // Invalidate auth cache for all affected users
    await Promise.all(affected.map((u) => this.authCache.invalidate(u.userId)));

    return { deleted: true };
  }

  /**
   * Assign a permission to a role.
   *
   * @note System roles CAN have their permissions modified from the dashboard.
   * Only deletion and renaming of system roles is restricted.
   * This allows admins to customize which permissions each role has.
   */
  async assignPermission(roleId: string, module: string, action: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'NOT_FOUND',
      });
    }

    const permission = await this.prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });
    if (!permission) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Permission not found',
        error: 'NOT_FOUND',
      });
    }

    // Check if already assigned
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
    });
    if (existing) {
      return existing;
    }

    const result = await this.prisma.rolePermission.create({
      data: { roleId, permissionId: permission.id },
      include: { permission: true },
    });

    await this.invalidateCacheForRole(roleId);

    return result;
  }

  /**
   * Remove a permission from a role.
   *
   * @note System roles CAN have permissions removed from the dashboard.
   * Only deletion and renaming of system roles is restricted.
   */
  async removePermission(roleId: string, module: string, action: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'NOT_FOUND',
      });
    }

    const permission = await this.prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });
    if (!permission) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Permission not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: permission.id },
    });

    await this.invalidateCacheForRole(roleId);

    return { deleted: true };
  }

  private async invalidateCacheForRole(roleId: string): Promise<void> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    await Promise.all(
      userRoles.map((u) => this.authCache.invalidate(u.userId)),
    );
  }
}
