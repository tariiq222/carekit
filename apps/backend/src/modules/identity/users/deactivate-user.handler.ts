import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeactivateUserCommand {
  userId: string;
  tenantId: string;
}

@Injectable()
export class DeactivateUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeactivateUserCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user || user.tenantId !== cmd.tenantId) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: cmd.userId }, data: { isActive: false } });
  }
}
