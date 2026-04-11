import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthCacheService } from '../auth/auth-cache.service.js';
import { PermissionCacheService } from '../auth/permission-cache.service.js';

@Injectable()
export class UserRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  async assignRole(
    userId: string,
    roleId?: string,
    roleSlug?: string,
    requesterId?: string,
  ): Promise<void> {
    let resolvedRoleId: string;

    if (roleId) {
      resolvedRoleId = roleId;
    } else if (roleSlug) {
      const roleBySlug = await this.prisma.role.findUnique({
        where: { slug: roleSlug },
      });
      if (!roleBySlug) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Role not found',
          error: 'ROLE_NOT_FOUND',
        });
      }
      resolvedRoleId = roleBySlug.id;
    } else {
      throw new BadRequestException({
        statusCode: 400,
        message: 'roleId or roleSlug is required',
        error: 'VALIDATION_ERROR',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const role = await this.prisma.role.findUnique({
      where: { id: resolvedRoleId },
    });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    // Prevent privilege escalation: only super_admin can assign the super_admin role
    if (role.slug === 'super_admin' && requesterId) {
      const requesterRoles = await this.prisma.userRole.findMany({
        where: { userId: requesterId },
        include: { role: true },
      });
      const isSuperAdmin = requesterRoles.some(
        (ur) => ur.role.slug === 'super_admin',
      );
      if (!isSuperAdmin) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Only super admins can assign the super_admin role',
          error: 'PRIVILEGE_ESCALATION',
        });
      }
    }

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: resolvedRoleId },
    });
    if (existing) return;

    await this.prisma.userRole.create({
      data: { userId, roleId: resolvedRoleId },
    });

    // Invalidate cached permissions so the user gets the new role immediately
    await this.authCache.invalidate(userId);
    await this.permissionCache.invalidate(userId);
  }

  async removeRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });
    if (!userRole) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role assignment not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    const roleCount = await this.prisma.userRole.count({ where: { userId } });
    if (roleCount <= 1) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot remove the last role from a user',
        error: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.userRole.delete({ where: { id: userRole.id } });

    // Invalidate cached permissions so the role removal takes effect immediately
    await this.authCache.invalidate(userId);
    await this.permissionCache.invalidate(userId);
  }
}
