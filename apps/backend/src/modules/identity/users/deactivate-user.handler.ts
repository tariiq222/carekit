import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeactivateUserCommand {
  userId: string;
}

@Injectable()
export class DeactivateUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeactivateUserCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user) throw new NotFoundException('User not found');

    // Last-active-OWNER protection: deactivating a user MUST NOT leave any of
    // their organizations without an active OWNER. Iterate every active OWNER
    // membership and confirm at least one other active OWNER exists in that org.
    const ownerMemberships = await this.prisma.$allTenants.membership.findMany({
      where: { userId: cmd.userId, role: 'OWNER', isActive: true },
      select: { id: true, organizationId: true },
    });

    for (const ownership of ownerMemberships) {
      const remaining = await this.prisma.$allTenants.membership.count({
        where: {
          organizationId: ownership.organizationId,
          role: 'OWNER',
          isActive: true,
          id: { not: ownership.id },
        },
      });
      if (remaining === 0) {
        throw new BadRequestException(
          `Cannot deactivate user: would leave organization ${ownership.organizationId} without an active OWNER`,
        );
      }
    }

    await this.prisma.user.update({ where: { id: cmd.userId }, data: { isActive: false } });
  }
}
