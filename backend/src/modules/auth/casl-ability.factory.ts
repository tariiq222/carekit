import { AbilityBuilder, PureAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';

/**
 * @note This factory is defined but not yet integrated with PermissionsGuard.
 * Current RBAC uses string-based permission matching in PermissionsGuard.
 * Future: integrate CASL for field-level and condition-based authorization.
 * See: https://casl.js.org/v6/en/guide/intro
 */

type Action = 'view' | 'create' | 'edit' | 'delete';
type AppAbility = PureAbility<[Action, string]>;

interface UserWithRoles {
  id: string;
  roles: Array<{
    slug: string;
    permissions: Array<{
      module: string;
      action: Action;
    }>;
  }>;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserWithRoles): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);

    // Collect all permissions from all roles (union)
    for (const role of user.roles) {
      for (const perm of role.permissions) {
        can(perm.action, perm.module);
      }
    }

    return build();
  }
}
