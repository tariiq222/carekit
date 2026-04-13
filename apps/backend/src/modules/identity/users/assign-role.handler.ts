import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AssignRoleCommand {
  tenantId: string;
  userId: string;
  customRoleId: string;
}

@Injectable()
export class AssignRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AssignRoleCommand): Promise<void> {
    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId, tenantId: cmd.tenantId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    const { count } = await this.prisma.user.updateMany({
      where: { id: cmd.userId, tenantId: cmd.tenantId },
      data: { customRoleId: cmd.customRoleId },
    });
    if (count === 0) throw new NotFoundException(`User ${cmd.userId} not found`);
  }
}
