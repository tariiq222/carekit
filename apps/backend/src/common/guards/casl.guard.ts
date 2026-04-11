import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subject = string;

export interface RequiredPermission {
  action: Action;
  subject: Subject;
}

export const CHECK_PERMISSIONS_KEY = 'requiredPermissions';

/** Declare permissions required to access a route. */
export const CheckPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(CHECK_PERMISSIONS_KEY, permissions);

export type AppAbility = MongoAbility;

/** Builds CASL ability from the user's roles + permissions attached by JwtStrategy. */
export function buildAbilityFor(user: {
  permissions: Array<{ action: string; subject: string }>;
}): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const p of user.permissions) {
    can(p.action as Action, p.subject);
  }

  return build();
}

/**
 * CASL guard — evaluates @CheckPermissions() metadata against the
 * current user's ability.
 *
 * Must run after JwtGuard so req.user is populated.
 */
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(
      CHECK_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: { permissions: Array<{ action: string; subject: string }> } }>();

    if (!user) throw new ForbiddenException('No authenticated user');

    const ability = buildAbilityFor(user);

    const allowed = required.every((p) => ability.can(p.action, p.subject));

    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
