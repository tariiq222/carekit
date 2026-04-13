import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface RemoveRoleCommand {
  tenantId: string;
  userId: string;
  customRoleId: string;
}

@Injectable()
export class RemoveRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RemoveRoleCommand): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: {
        id: cmd.userId,
        tenantId: cmd.tenantId,
        customRoleId: cmd.customRoleId,
      },
      data: { customRoleId: null },
    });
    if (count === 0) {
      throw new NotFoundException(
        `User ${cmd.userId} does not have role ${cmd.customRoleId} assigned`,
      );
    }
  }
}
