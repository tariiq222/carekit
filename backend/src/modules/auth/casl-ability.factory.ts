import { AbilityBuilder, PureAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';

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
        can(perm.action as Action, perm.module);
      }
    }

    return build();
  }
}
