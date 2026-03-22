import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class UserRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async assignRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });
    if (existing) return;

    await this.prisma.userRole.create({
      data: { userId, roleId },
    });
  }

  async removeRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });
    if (!userRole) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role assignment not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    const roleCount = await this.prisma.userRole.count({ where: { userId } });
    if (roleCount <= 1) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot remove the last role from a user',
        error: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.userRole.delete({ where: { id: userRole.id } });
  }
}
