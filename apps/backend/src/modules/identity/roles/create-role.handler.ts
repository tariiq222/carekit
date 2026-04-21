import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateRoleDto } from './create-role.dto';

export type CreateRoleCommand = CreateRoleDto;

@Injectable()
export class CreateRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateRoleCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const existing = await this.prisma.customRole.findUnique({
      where: { organizationId_name: { organizationId, name: cmd.name } },
    });
    if (existing) throw new ConflictException(`Role "${cmd.name}" already exists`);
    return this.prisma.customRole.create({
      data: { name: cmd.name, organizationId },
      include: { permissions: true },
    });
  }
}
