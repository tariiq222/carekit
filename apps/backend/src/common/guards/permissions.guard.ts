import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/check-permissions.decorator.js';
import type { UserPayload } from '../types/user-payload.type.js';

/**
 * @note Uses string-based permission matching: `${module}:${action}`
 * CASL factory (casl-ability.factory.ts) is available for future
 * field-level authorization if needed.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: UserPayload;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied',
        error: 'FORBIDDEN',
      });
    }

    const userPermissions = new Set(user.permissions ?? []);

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
}
