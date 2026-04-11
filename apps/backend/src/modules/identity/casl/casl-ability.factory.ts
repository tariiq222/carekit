import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type AppAbility = MongoAbility;

const BUILT_IN: Record<string, Array<{ action: string; subject: string }>> = {
  SUPER_ADMIN: [{ action: 'manage', subject: 'all' }],
  ADMIN: [
    { action: 'manage', subject: 'User' },
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'manage', subject: 'Employee' },
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'manage', subject: 'Report' },
    { action: 'manage', subject: 'Setting' },
  ],
  RECEPTIONIST: [
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'read', subject: 'Employee' },
    { action: 'read', subject: 'Invoice' },
  ],
  ACCOUNTANT: [
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Report' },
  ],
  EMPLOYEE: [
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Client' },
    { action: 'update', subject: 'Booking' },
  ],
  CLIENT: [
    { action: 'read', subject: 'Booking' },
    { action: 'create', subject: 'Booking' },
    { action: 'read', subject: 'Invoice' },
  ],
};

@Injectable()
export class CaslAbilityFactory {
  buildForUser(user: {
    role: string;
    customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    if (user.customRole) {
      for (const p of user.customRole.permissions) can(p.action, p.subject);
    } else {
      for (const p of BUILT_IN[user.role] ?? []) can(p.action, p.subject);
    }
    return build();
  }
}
