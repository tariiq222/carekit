import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/check-permissions.decorator.js';
import { PermissionCacheService } from '../permission-cache.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; email: string };
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied',
        error: 'FORBIDDEN',
      });
    }

    const userPermissions = await this.resolvePermissions(user.id);

    // Check if user has ALL required permissions
    for (const required of requiredPermissions) {
      if (!userPermissions.has(`${required.module}:${required.action}`)) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'You do not have permission to perform this action',
          error: 'FORBIDDEN',
        });
      }
    }

    return true;
  }

  private async resolvePermissions(userId: string): Promise<Set<string>> {
    // Try cache first
    const cached = await this.permissionCache.get(userId);
    if (cached) return cached;

    // Cache miss — fetch from DB
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied',
        error: 'FORBIDDEN',
      });
    }

    const permissions = new Set<string>();
    for (const ur of dbUser.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }

    // Store in cache for subsequent requests
    await this.permissionCache.set(userId, permissions);
    return permissions;
  }
}
