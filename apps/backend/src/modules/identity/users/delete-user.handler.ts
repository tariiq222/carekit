import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteUserCommand {
  userId: string;
  tenantId: string;
}

@Injectable()
export class DeleteUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeleteUserCommand): Promise<void> {
    const { count } = await this.prisma.user.deleteMany({
      where: { id: cmd.userId, tenantId: cmd.tenantId },
    });
    if (count === 0) throw new NotFoundException(`User ${cmd.userId} not found`);
  }
}
