import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UserGender, UserRole } from '@prisma/client';

export interface UpdateUserCommand {
  userId: string;
  name?: string;
  phone?: string;
  gender?: UserGender;
  role?: UserRole;
  customRoleId?: string | null;
  avatarUrl?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateUserCommand) {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: cmd.userId },
      data: {
        name: cmd.name,
        phone: cmd.phone,
        gender: cmd.gender,
        role: cmd.role,
        customRoleId: cmd.customRoleId,
        avatarUrl: cmd.avatarUrl,
        isActive: cmd.isActive,
      },
      omit: { passwordHash: true },
    });
  }
}
