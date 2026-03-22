import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async create(dto: CreateRoleDto) {
    const slug = dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '_');

    const existing = await this.prisma.role.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Role with this name already exists');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        isSystem: false,
        isDefault: false,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  async delete(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    await this.prisma.role.delete({ where: { id } });
    return { deleted: true };
  }

  async assignPermission(roleId: string, module: string, action: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permission = await this.prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if already assigned
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: permission.id,
      },
      include: { permission: true },
    });
  }

  async removePermission(roleId: string, module: string, action: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: permission.id,
      },
    });

    return { deleted: true };
  }
}
