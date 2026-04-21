import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface DeleteRoleCommand {
  customRoleId: string;
}

@Injectable()
export class DeleteRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DeleteRoleCommand): Promise<void> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId, organizationId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { customRoleId: cmd.customRoleId },
        data: { customRoleId: null },
      }),
      this.prisma.customRole.delete({ where: { id: cmd.customRoleId } }),
    ]);
  }
}
