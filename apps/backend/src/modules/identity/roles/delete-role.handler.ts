import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteRoleCommand {
  customRoleId: string;
  tenantId: string;
}

@Injectable()
export class DeleteRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeleteRoleCommand): Promise<void> {
    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId, tenantId: cmd.tenantId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { customRoleId: cmd.customRoleId, tenantId: cmd.tenantId },
        data: { customRoleId: null },
      }),
      this.prisma.customRole.delete({ where: { id: cmd.customRoleId } }),
    ]);
  }
}
