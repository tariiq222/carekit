import { Injectable } from '@nestjs/common';

export interface PermissionDto {
  id: string;
  module: string;
  action: string;
}

const ACTIONS = ['manage', 'create', 'read', 'update', 'delete'] as const;
const SUBJECTS = [
  'User',
  'Booking',
  'Client',
  'Employee',
  'Invoice',
  'Payment',
  'Report',
  'Setting',
  'Service',
  'Branch',
  'Coupon',
  'Role',
];

@Injectable()
export class ListPermissionsHandler {
  async execute(): Promise<PermissionDto[]> {
    const out: PermissionDto[] = [];
    for (const subject of SUBJECTS) {
      for (const action of ACTIONS) {
        out.push({
          id: `${subject}:${action}`,
          module: subject,
          action,
        });
      }
    }
    return out;
  }
}
