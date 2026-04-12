import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateRoleDto } from './create-role.dto';

export type CreateRoleCommand = CreateRoleDto & { tenantId: string };

@Injectable()
export class CreateRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateRoleCommand) {
    const existing = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId: cmd.tenantId, name: cmd.name } },
    });
    if (existing) throw new ConflictException(`Role "${cmd.name}" already exists`);
    return this.prisma.customRole.create({
      data: { tenantId: cmd.tenantId, name: cmd.name },
      include: { permissions: true },
    });
  }
}
