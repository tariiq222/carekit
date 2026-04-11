import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { AssignPermissionsDto } from './assign-permissions.dto';

@Injectable()
export class AssignPermissionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: AssignPermissionsDto): Promise<void> {
    await this.prisma.permission.deleteMany({ where: { customRoleId: dto.customRoleId } });
    await this.prisma.permission.createMany({
      data: dto.permissions.map((p) => ({
        tenantId: dto.tenantId,
        customRoleId: dto.customRoleId,
        action: p.action,
        subject: p.subject,
      })),
    });
  }
}
