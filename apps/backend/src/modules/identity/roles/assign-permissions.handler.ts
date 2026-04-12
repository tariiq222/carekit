import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsDto } from './assign-permissions.dto';

export type AssignPermissionsCommand = AssignPermissionsDto & { tenantId: string };

@Injectable()
export class AssignPermissionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AssignPermissionsCommand): Promise<void> {
    await this.prisma.permission.deleteMany({ where: { customRoleId: cmd.customRoleId } });
    await this.prisma.permission.createMany({
      data: cmd.permissions.map((p) => ({
        tenantId: cmd.tenantId,
        customRoleId: cmd.customRoleId,
        action: p.action,
        subject: p.subject,
      })),
    });
  }
}
