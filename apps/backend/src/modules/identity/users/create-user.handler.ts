import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { CreateUserDto } from './create-user.dto';

export type CreateUserCommand = CreateUserDto & { tenantId: string };

@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  async execute(cmd: CreateUserCommand) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: cmd.tenantId, email: cmd.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.password.hash(cmd.password);
    return this.prisma.user.create({
      data: {
        tenantId: cmd.tenantId,
        email: cmd.email,
        passwordHash,
        name: cmd.name,
        role: cmd.role,
        phone: cmd.phone,
        gender: cmd.gender,
        customRoleId: cmd.customRoleId,
      },
      omit: { passwordHash: true },
    });
  }
}
