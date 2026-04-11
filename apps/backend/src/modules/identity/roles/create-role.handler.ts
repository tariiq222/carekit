import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateRoleDto } from './create-role.dto';

@Injectable()
export class CreateRoleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateRoleDto) {
    const existing = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId: dto.tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);
    return this.prisma.customRole.create({
      data: { tenantId: dto.tenantId, name: dto.name },
      include: { permissions: true },
    });
  }
}
